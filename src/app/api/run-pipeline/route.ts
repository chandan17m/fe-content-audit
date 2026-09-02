import { saveAuditRun } from "@/lib/audit-store";
import { cleanArticleText, normalizePipelineOutput } from "@/lib/pipeline";
import { getModulePrompts } from "@/lib/server-prompts";
import { createClient } from "@/lib/supabase-server";

const anthropicMessagesUrl = "https://api.anthropic.com/v1/messages";
const defaultModel = "claude-sonnet-4-6";

type ClaudeUsage = {
  inputTokens: number;
  outputTokens: number;
};

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
  const apiKey = process.env.MODEL_PROVIDER_API_KEY;

  if (!apiKey) {
    return Response.json({ message: "Model API key is not configured on the server." }, { status: 503 });
  }

  const headline = body.headline ?? "";
  const authorUrl = body.authorUrl ?? "";
  const excerpt = body.excerpt ?? "";
  const cleaned = cleanArticleText(body.content ?? "");
  const authorPage = await fetchAuthorPage(authorUrl);

  let module1: Record<string, unknown>;
  let module2: Record<string, unknown>;
  let narrative: string;
  let usage: ClaudeUsage = { inputTokens: 0, outputTokens: 0 };

  try {
    const m1 = await runStructuredModule({
      apiKey,
      model: process.env.MODEL_PROVIDER_MODEL || defaultModel,
      toolName: "save_module_1_classification",
      prompt: prompts.module1,
      instruction: buildModule1Input({ headline, authorUrl, authorPage, excerpt, articleBody: body.content ?? "" }),
    });
    module1 = m1.output;
    usage = addUsage(usage, m1.usage);
    const module1CleanedBody = typeof module1.cleaned_body === "string" ? module1.cleaned_body : cleaned;

    const m2 = await runStructuredModule({
      apiKey,
      model: process.env.MODEL_PROVIDER_MODEL || defaultModel,
      toolName: "save_module_2_scoring",
      prompt: prompts.module2,
      instruction: [
        "INPUT 1 - MODULE 1 JSON:",
        JSON.stringify(module1, null, 2),
        "",
        "INPUT 2 - CLEANED BODY:",
        module1CleanedBody,
      ].join("\n"),
    });
    module2 = m2.output;
    usage = addUsage(usage, m2.usage);

    const m3 = await runNarrativeModule({
      apiKey,
      model: process.env.MODEL_PROVIDER_MODEL || defaultModel,
      prompt: prompts.module3,
      instruction: ["INPUT - MODULE 2 JSON:", JSON.stringify(module2, null, 2)].join("\n"),
    });
    narrative = m3.output;
    usage = addUsage(usage, m3.usage);
  } catch (error) {
    return Response.json(
      { status: "model_error", message: error instanceof Error ? error.message : "Model provider request failed." },
      { status: 502 },
    );
  }

  const finalJson = {
    schema_version: "pipeline-v3.0",
    action_tag: extractActionTag(narrative) || "REWORK",
    domain_signal_impact: extractDomainSignal(narrative) || "Neutral",
    confidence: extractConfidence(narrative) || "Low",
    human_review_required: /HUMAN REVIEW:\s*Yes/i.test(narrative),
    editorial_summary: extractNarrativeSection(narrative, "EDITORIAL SUMMARY") || narrative.slice(0, 600),
    recommendations: extractRecommendations(narrative),
    word_count: cleaned.split(/\s+/).filter(Boolean).length,
    module1,
    module2,
    module3_narrative: narrative,
  };
  const output = normalizePipelineOutput(finalJson, cleaned);
  const savedRun = await saveAuditRun({
    userEmail: user.email,
    headline: headline || "Untitled analysis",
    authorUrl,
    excerpt,
    cleanedBody: cleaned,
    output: finalJson,
    status: "success",
    reason: output.editorialSummary,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  }).catch(() => null);

  return Response.json({
    runId: savedRun?.id ?? crypto.randomUUID(),
    status: "complete",
    cleaned,
    wordCount: savedRun?.wordCount ?? finalJson.word_count,
    estimatedCostInr: savedRun?.estimatedCostInr ?? 0,
    output,
    promptConfigured: Boolean(prompts.module1 && prompts.module2 && prompts.module3),
    completedAt: new Date().toISOString(),
  });
}

async function runStructuredModule({
  apiKey,
  model,
  toolName,
  prompt,
  instruction,
}: {
  apiKey: string;
  model: string;
  toolName: string;
  prompt: string;
  instruction: string;
}) {
  const data = await callClaude({
    apiKey,
    model,
    body: {
      model,
      max_tokens: 4000,
      system: `${prompt}\n\nReturn the module result by calling ${toolName}.`,
      tools: [
        {
          name: toolName,
          description: "Return valid structured JSON for this FE content audit module.",
          input_schema: { type: "object", additionalProperties: true },
        },
      ],
      tool_choice: { type: "tool", name: toolName },
      messages: [{ role: "user", content: instruction }],
    },
  });
  const output = data.content?.find((item) => item.type === "tool_use" && item.name === toolName)?.input;

  if (!output || typeof output !== "object") {
    throw new Error("Model provider returned an invalid structured response.");
  }

  return { output: output as Record<string, unknown>, usage: readUsage(data) };
}

async function runNarrativeModule({
  apiKey,
  model,
  prompt,
  instruction,
}: {
  apiKey: string;
  model: string;
  prompt: string;
  instruction: string;
}) {
  const data = await callClaude({
    apiKey,
    model,
    body: {
      model,
      max_tokens: 2500,
      system: prompt,
      messages: [{ role: "user", content: instruction }],
    },
  });
  const output = data.content?.find((item) => item.type === "text")?.text?.trim();

  if (!output) {
    throw new Error("Model provider returned an empty narrative response.");
  }

  return { output, usage: readUsage(data) };
}

async function callClaude({
  apiKey,
  body,
}: {
  apiKey: string;
  model: string;
  body: Record<string, unknown>;
}) {
  const response = await fetch(anthropicMessagesUrl, {
    method: "POST",
    headers: {
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as {
    content?: Array<{ type?: string; text?: string; name?: string; input?: unknown }>;
    usage?: { input_tokens?: number; output_tokens?: number };
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(data.error?.message || "Model provider request failed.");
  }

  return data;
}

async function fetchAuthorPage(authorUrl: string) {
  if (!authorUrl.trim()) {
    return { status: null, content: "" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(authorUrl, {
      signal: controller.signal,
      headers: { "user-agent": "FEContentAudit/1.0" },
    });
    clearTimeout(timeout);
    const html = await response.text();

    return {
      status: String(response.status),
      content: htmlToText(html).slice(0, 12000),
    };
  } catch {
    return { status: "timeout", content: "" };
  }
}

function buildModule1Input({
  headline,
  authorUrl,
  authorPage,
  excerpt,
  articleBody,
}: {
  headline: string;
  authorUrl: string;
  authorPage: { status: string | null; content: string };
  excerpt: string;
  articleBody: string;
}) {
  return [
    `HEADLINE: ${headline}`,
    `AUTHOR_URL: ${authorUrl || "null"}`,
    `AUTHOR_URL_HTTP_STATUS: ${authorPage.status ?? "null"}`,
    "AUTHOR_PAGE_CONTENT:",
    authorPage.content || "",
    "",
    `EXCERPT: ${excerpt || "null"}`,
    "ARTICLE_BODY:",
    articleBody,
  ].join("\n");
}

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function readUsage(data: { usage?: { input_tokens?: number; output_tokens?: number } }): ClaudeUsage {
  return {
    inputTokens: Number(data.usage?.input_tokens || 0),
    outputTokens: Number(data.usage?.output_tokens || 0),
  };
}

function addUsage(first: ClaudeUsage, second: ClaudeUsage): ClaudeUsage {
  return {
    inputTokens: first.inputTokens + second.inputTokens,
    outputTokens: first.outputTokens + second.outputTokens,
  };
}

function extractActionTag(text: string) {
  return text.match(/ACTION:\s*(RETAIN|REWORK|NOINDEX|DELETE_410|NOT_APPLICABLE)/i)?.[1]?.toUpperCase();
}

function extractDomainSignal(text: string) {
  const value = text.match(/DOMAIN SIGNAL:\s*(Positive|Neutral|Negative)/i)?.[1];
  return value ? value[0].toUpperCase() + value.slice(1).toLowerCase() : undefined;
}

function extractConfidence(text: string) {
  const value = text.match(/CONFIDENCE:\s*(High|Medium|Low)/i)?.[1];
  return value ? value[0].toUpperCase() + value.slice(1).toLowerCase() : undefined;
}

function extractNarrativeSection(text: string, label: string) {
  const match = text.match(new RegExp(`${label}:\\s*([\\s\\S]+?)(?:\\n\\n[A-Z][A-Z\\s-]+:|$)`, "i"));
  return match?.[1]?.trim();
}

function extractRecommendations(text: string) {
  const section = extractNarrativeSection(text, "RECOMMENDATIONS");

  if (!section || /^None\./i.test(section)) {
    return [];
  }

  return section
    .split(/\n+/)
    .map((line) => line.replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean);
}
