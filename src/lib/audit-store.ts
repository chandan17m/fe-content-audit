import "server-only";

import { createAdminClient } from "@/lib/supabase-admin";

export type UserRole = "admin" | "user";

export type AppUser = {
  id: string;
  email: string;
  role: UserRole;
  lastLoginAt: string | null;
};

export type SavedAnalysis = {
  id: string;
  headline: string;
  authorUrl: string;
  userEmail: string;
  checkedAt: string;
  actionTag: string;
  wordCount: number;
};

export type AdminDashboard = {
  summary: {
    checksRun: number;
    uniqueArticlesChecked: number;
    activeUsers: number;
    totalTokensUsed: number;
    totalEstimatedCostInr: number;
  };
  recentUsage: Array<{
    id: string;
    userEmail: string;
    loggedInAt: string | null;
    checkedOn: string;
    status: string;
    reason: string;
    urlCount: number;
    wordCount: number;
    estimatedCostInr: number;
  }>;
  userActivity: Array<{
    id: string;
    userEmail: string;
    role: UserRole;
    dateTime: string;
  }>;
};

const ownerAdminEmail = "chandan.kumar@indianexpress.com";
const inrPerUsd = 95;
const sonnetInputUsdPerMillion = 3;
const sonnetOutputUsdPerMillion = 15;

export async function getOrCreateAppUser(user: { id: string; email?: string | null }) {
  if (!user.email) {
    return null;
  }

  const supabase = createAdminClient();
  const email = user.email.toLowerCase();
  const defaultRole: UserRole = email === ownerAdminEmail ? "admin" : "user";
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("app_users")
    .select("id,email,role,last_login_at")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("app_users")
      .update({ auth_user_id: user.id, last_login_at: now, status: "active" })
      .eq("id", existing.id);

    await logUserActivity(email, existing.role as UserRole, "login");

    return {
      id: String(existing.id),
      email: String(existing.email),
      role: existing.role as UserRole,
      lastLoginAt: now,
    };
  }

  const { data, error } = await supabase
    .from("app_users")
    .insert({
      auth_user_id: user.id,
      email,
      role: defaultRole,
      status: "active",
      last_login_at: now,
    })
    .select("id,email,role,last_login_at")
    .single();

  if (error) {
    throw error;
  }

  await logUserActivity(email, defaultRole, "login");

  return {
    id: String(data.id),
    email: String(data.email),
    role: data.role as UserRole,
    lastLoginAt: data.last_login_at as string | null,
  };
}

export async function getAppUserByEmail(email?: string | null) {
  if (!email) {
    return null;
  }

  const supabase = createAdminClient();
  const normalizedEmail = email.toLowerCase();

  const { data } = await supabase
    .from("app_users")
    .select("id,email,role,last_login_at,status")
    .eq("email", normalizedEmail)
    .eq("status", "active")
    .maybeSingle();

  if (!data && normalizedEmail === ownerAdminEmail) {
    return {
      id: "owner-admin",
      email: normalizedEmail,
      role: "admin" as UserRole,
      lastLoginAt: null,
    };
  }

  if (!data) {
    return null;
  }

  return {
    id: String(data.id),
    email: String(data.email),
    role: data.role as UserRole,
    lastLoginAt: data.last_login_at as string | null,
  };
}

export async function isAdminEmail(email?: string | null) {
  const user = await getAppUserByEmail(email);
  return user?.role === "admin";
}

export async function upsertAccessUser({
  adminEmail,
  email,
  role,
}: {
  adminEmail: string;
  email: string;
  role: UserRole;
}) {
  const supabase = createAdminClient();
  const normalizedEmail = email.toLowerCase();

  const { data, error } = await supabase
    .from("app_users")
    .upsert(
      {
        email: normalizedEmail,
        role,
        status: "active",
        invited_by: adminEmail.toLowerCase(),
      },
      { onConflict: "email" },
    )
    .select("id,email,role,last_login_at")
    .single();

  if (error) {
    throw error;
  }

  await logUserActivity(normalizedEmail, role, "access_granted");

  return data;
}

export async function saveAuditRun({
  userEmail,
  headline,
  authorUrl,
  excerpt,
  cleanedBody,
  output,
  status,
  reason,
  inputTokens,
  outputTokens,
}: {
  userEmail: string;
  headline: string;
  authorUrl: string;
  excerpt: string;
  cleanedBody: string;
  output: Record<string, unknown>;
  status: "success" | "failure";
  reason: string;
  inputTokens: number;
  outputTokens: number;
}) {
  const supabase = createAdminClient();
  const wordCount = countWords(cleanedBody);
  const articleKey = createArticleKey(headline, authorUrl, cleanedBody);
  const urlCount = authorUrl.trim() ? 1 : 0;
  const estimatedCostInr = estimateCostInr(inputTokens, outputTokens);

  const { data, error } = await supabase
    .from("audit_runs")
    .insert({
      user_email: userEmail.toLowerCase(),
      headline,
      author_url: authorUrl,
      excerpt,
      article_key: articleKey,
      status,
      reason,
      url_count: urlCount,
      word_count: wordCount,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_inr: estimatedCostInr,
      output,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return {
    id: String(data.id),
    wordCount,
    estimatedCostInr,
    inputTokens,
    outputTokens,
  };
}

export async function saveFeedback({
  runId,
  userEmail,
  feedback,
  expected,
}: {
  runId?: string | null;
  userEmail: string;
  feedback: string;
  expected?: string;
}) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("feedback_reports")
    .insert({
      run_id: runId || null,
      user_email: userEmail.toLowerCase(),
      feedback,
      expected: expected || null,
      status: "pending_admin_review",
    })
    .select("id,status,created_at")
    .single();

  if (error) {
    throw error;
  }

  await logUserActivity(userEmail, (await getAppUserByEmail(userEmail))?.role ?? "user", "feedback_submitted");

  return data;
}

export async function getSavedAnalyses() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("audit_runs")
    .select("id,headline,author_url,user_email,created_at,word_count,output")
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row): SavedAnalysis => {
    const output = row.output as { action_tag?: string; actionTag?: string } | null;

    return {
      id: String(row.id),
      headline: String(row.headline || "Untitled analysis"),
      authorUrl: String(row.author_url || ""),
      userEmail: String(row.user_email),
      checkedAt: String(row.created_at),
      actionTag: output?.action_tag || output?.actionTag || "REVIEW",
      wordCount: Number(row.word_count || 0),
    };
  });
}

export async function deleteAnalysis(runId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("audit_runs").delete().eq("id", runId);

  if (error) {
    throw error;
  }
}

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const supabase = createAdminClient();

  const { data: runs, error: runsError } = await supabase
    .from("audit_runs")
    .select("id,user_email,article_key,status,reason,url_count,word_count,input_tokens,output_tokens,estimated_cost_inr,created_at");

  if (runsError) {
    throw runsError;
  }

  const { data: users, error: usersError } = await supabase
    .from("app_users")
    .select("email,role,last_login_at,status");

  if (usersError) {
    throw usersError;
  }

  const { data: activity, error: activityError } = await supabase
    .from("user_activity")
    .select("id,user_email,role,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (activityError) {
    throw activityError;
  }

  const totalInputTokens = sumNumbers(runs, "input_tokens");
  const totalOutputTokens = sumNumbers(runs, "output_tokens");

  return {
    summary: {
      checksRun: runs?.length ?? 0,
      uniqueArticlesChecked: new Set((runs ?? []).map((run) => run.article_key).filter(Boolean)).size,
      activeUsers: (users ?? []).filter((user) => user.status === "active").length,
      totalTokensUsed: totalInputTokens + totalOutputTokens,
      totalEstimatedCostInr: sumNumbers(runs, "estimated_cost_inr"),
    },
    recentUsage: (runs ?? [])
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 25)
      .map((run) => ({
        id: String(run.id),
        userEmail: String(run.user_email),
        loggedInAt:
          (users ?? []).find((user) => String(user.email).toLowerCase() === String(run.user_email).toLowerCase())
            ?.last_login_at ?? null,
        checkedOn: String(run.created_at),
        status: String(run.status || "failure"),
        reason: String(run.reason || ""),
        urlCount: Number(run.url_count || 0),
        wordCount: Number(run.word_count || 0),
        estimatedCostInr: Number(run.estimated_cost_inr || 0),
      })),
    userActivity: (activity ?? []).map((row) => ({
      id: String(row.id),
      userEmail: String(row.user_email),
      role: row.role as UserRole,
      dateTime: String(row.created_at),
    })),
  };
}

export async function logUserActivity(userEmail: string, role: UserRole, activityType: string) {
  const supabase = createAdminClient();

  await supabase.from("user_activity").insert({
    user_email: userEmail.toLowerCase(),
    role,
    activity_type: activityType,
  });
}

export function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function sumNumbers<T extends Record<string, unknown>>(items: T[] | null, key: keyof T) {
  return (items ?? []).reduce((total, item) => total + Number(item[key] || 0), 0);
}

function estimateCostInr(inputTokens: number, outputTokens: number) {
  const usd =
    (inputTokens / 1_000_000) * sonnetInputUsdPerMillion +
    (outputTokens / 1_000_000) * sonnetOutputUsdPerMillion;

  return Number((usd * inrPerUsd).toFixed(4));
}

function createArticleKey(headline: string, authorUrl: string, body: string) {
  const source = `${headline.trim().toLowerCase()}|${authorUrl.trim().toLowerCase()}|${body.slice(0, 500)}`;
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash << 5) - hash + source.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}
