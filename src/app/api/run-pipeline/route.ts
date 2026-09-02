import { saveAuditRun } from "@/lib/audit-store";
import { cleanArticleText, normalizePipelineOutput } from "@/lib/pipeline";
import { getModulePrompts } from "@/lib/server-prompts";
import { createClient } from "@/lib/supabase-server";

const anthropicMessagesUrl = "https://api.anthropic.com/v1/messages";
const defaultModel = "claude-sonnet-4-6";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return Response.json({ message: "Login is required." }, { status: 401 });
  }

  const prompts = await getModulePrompts();
  const body = (await request.json()) as {
    content?: string;
    headline?: string;
    authorUrl?: string;
    excerpt?: string;
  };

  const cleaned = cleanArticleText(body.content ?? "");
  const apiKey = process.env.MODEL_PROVIDER_API_KEY;

  if (!apiKey) {
    return Response.json(
      {
        status: "configuration_error",
        message: "Model API key is not configured on the server.",
      },
      { status: 503 },
    );
  }

  let modelResult: Awaited<ReturnType<typeof runClaudeAudit>>;

  try {
    modelResult = await runClaudeAudit({
      apiKey,
      model: process.env.MODEL_PROVIDER_MODEL || defaultModel,
      prompts,
      headline: body.headline ?? "",
      authorUrl: body.authorUrl ?? "",
      excerpt: body.excerpt ?? "",
      cleaned,
    });
  } catch (error) {
    return Response.json(
      {
        status: "model_error",
        message: error instanceof Error ? error.message : "Model provider request failed.",
      },
      { status: 502 },
    );
  }

  const output = normalizePipelineOutput(modelResult.json, cleaned);
  const savedRun = await saveAuditRun({
    userEmail: user.email,
    headline: body.headline ?? "Untitled analysis",
    authorUrl: body.authorUrl ?? "",
    excerpt: body.excerpt ?? "",
    cleanedBody: cleaned,
    output: output.json,
    status: "success",
    reason: output.editorialSummary,
    inputTokens: modelResult.inputTokens,
    outputTokens: modelResult.outputTokens,
  }).catch(() => null);

  return Response.json({
    runId: savedRun?.id ?? crypto.randomUUID(),
    status: "complete",
    cleaned,
    wordCount: savedRun?.wordCount ?? cleaned.split(/\s+/).filter(Boolean).length,
    estimatedCostInr: savedRun?.estimatedCostInr ?? 0,
    output,
    promptConfigured: Boolean(prompts.module1 && prompts.module2 && prompts.module3),
    completedAt: new Date().toISOString(),
  });
}

async function runClaudeAudit({
  apiKey,
  model,
  prompts,
  headline,
  authorUrl,
  excerpt,
  cleaned,
}: {
  apiKey: string;
  model: string;
  prompts: Awaited<ReturnType<typeof getModulePrompts>>;
  headline: string;
  authorUrl: string;
  excerpt: string;
  cleaned: string;
}) {
  const response = await fetch(anthropicMessagesUrl, {
    method: "POST",
    headers: {
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      system:
        "You are the server-side FE Content Audit engine. Follow the three supplied modules exactly. Return only one valid JSON object. Do not include markdown fences, commentary, or hidden reasoning.",
      messages: [
        {
          role: "user",
          content: [
            "Run the complete FE Content Audit pipeline on this article.",
            "",
            "Required output JSON keys:",
            "action_tag, domain_signal_impact, confidence, human_review_required, editorial_summary, recommendations, word_count, classification, scoring, evidence, flags",
            "",
            "Allowed action_tag values: RETAIN, REWORK, NOINDEX, DELETE_410, NOT_APPLICABLE.",
            "Allowed domain_signal_impact values: Positive, Neutral, Negative.",
            "Allowed confidence values: High, Medium, Low.",
            "",
            "MODULE 1 PROMPT:",
            prompts.module1,
            "",
            "MODULE 2 PROMPT:",
            prompts.module2,
            "",
            "MODULE 3 PROMPT:",
            prompts.module3,
            "",
            "ARTICLE METADATA:",
            JSON.stringify({ headline, author_url: authorUrl, excerpt }),
            "",
            "CLEANED ARTICLE BODY:",
            cleaned,
          ].join("\n"),
        },
      ],
    }),
  });

  const data = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(data.error?.message || "Model provider request failed.");
  }

  const text = data.content?.find((item) => item.type === "text")?.text?.trim();

  if (!text) {
    throw new Error("Model provider returned an empty response.");
  }

  return {
    json: parseJsonObject(text),
    inputTokens: Number(data.usage?.input_tokens || 0),
    outputTokens: Number(data.usage?.output_tokens || 0),
  };
}

function parseJsonObject(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }

    throw new Error("Model response was not valid JSON.");
  }
}
