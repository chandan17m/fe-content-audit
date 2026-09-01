export type PipelineStep = {
  id: "step-0" | "module-1" | "module-2" | "module-3";
  label: string;
  status: "queued" | "running" | "complete" | "blocked";
  detail: string;
};

export type PipelineOutput = {
  actionTag: "RETAIN" | "REWORK" | "NOINDEX" | "DELETE_410" | "NOT_APPLICABLE";
  domainSignalImpact: "Positive" | "Neutral" | "Negative";
  confidence: "High" | "Medium" | "Low";
  humanReviewRequired: boolean;
  recommendations: string[];
  editorialSummary: string;
  json: Record<string, unknown>;
};

const junkPatterns = [
  /FE Google Preferred Button/gi,
  /Follow Us/gi,
  /FE Stock Insights on WhatsApp[\s\S]*?(?=\n\n|$)/gi,
  /STORIES YOU MAY LIKE[\s\S]*?(?=\n\n|$)/gi,
  /ALSO READ:?[\s\S]*?(?=\n|$)/gi,
  /(?:Home|Markets|Money|Business)\s*>\s*/gi,
];

export function cleanArticleText(input: string) {
  return junkPatterns
    .reduce((body, pattern) => body.replace(pattern, ""), input)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function createInitialSteps(): PipelineStep[] {
  return [
    {
      id: "step-0",
      label: "Step 0",
      status: "queued",
      detail: "Clean body text",
    },
    {
      id: "module-1",
      label: "Module 1",
      status: "queued",
      detail: "Classification",
    },
    {
      id: "module-2",
      label: "Module 2",
      status: "queued",
      detail: "Scoring",
    },
    {
      id: "module-3",
      label: "Module 3",
      status: "queued",
      detail: "Action tag",
    },
  ];
}

export function buildPrototypeOutput(cleanedBody: string): PipelineOutput {
  const wordCount = cleanedBody.split(/\s+/).filter(Boolean).length;
  const isThin = wordCount > 0 && wordCount < 250;
  const actionTag = isThin ? "REWORK" : "RETAIN";
  const confidence = cleanedBody.length > 1800 ? "High" : cleanedBody.length > 600 ? "Medium" : "Low";

  return {
    actionTag,
    domainSignalImpact: actionTag === "RETAIN" ? "Positive" : "Neutral",
    confidence,
    humanReviewRequired: confidence !== "High",
    recommendations: [
      isThin
        ? "[STRUCTURAL_INFLATION] Expand the article body before publication decisioning."
        : "[DATA_CLARITY_FAIL] Confirm that financial figures retain source citations.",
      "[AUTHOR_STATUS] Verify author bio before moving the article to final queue.",
      "[EDITORIAL_REVIEW] Admin must approve feedback before it enters training data.",
    ],
    editorialSummary:
      "Prototype run completed using local deterministic logic. Connect the model API to replace placeholder classification and scoring.",
    json: {
      schema_version: "prototype-v0.1",
      action_tag: actionTag,
      word_count: wordCount,
      domain_signal_impact: actionTag === "RETAIN" ? "Positive" : "Neutral",
      confidence,
      human_review_required: confidence !== "High",
    },
  };
}

export function normalizePipelineOutput(raw: unknown, cleanedBody: string): PipelineOutput {
  const fallback = buildPrototypeOutput(cleanedBody);

  if (!raw || typeof raw !== "object") {
    return {
      ...fallback,
      actionTag: "REWORK",
      confidence: "Low",
      humanReviewRequired: true,
      editorialSummary: "Model response could not be parsed. Human review is required.",
      recommendations: ["[MODEL_PARSE_FAIL] Re-run the article or review the model response manually."],
      json: {
        schema_version: "model-parse-fallback-v0.1",
        human_review_required: true,
        raw_response: raw,
      },
    };
  }

  const data = raw as Record<string, unknown>;
  const actionTag = normalizeEnum(data.action_tag ?? data.actionTag, [
    "RETAIN",
    "REWORK",
    "NOINDEX",
    "DELETE_410",
    "NOT_APPLICABLE",
  ] as const, fallback.actionTag);
  const domainSignalImpact = normalizeEnum(data.domain_signal_impact ?? data.domainSignalImpact, [
    "Positive",
    "Neutral",
    "Negative",
  ] as const, fallback.domainSignalImpact);
  const confidence = normalizeEnum(data.confidence, ["High", "Medium", "Low"] as const, "Low");
  const recommendations = normalizeStringArray(data.recommendations);
  const editorialSummary =
    typeof data.editorial_summary === "string"
      ? data.editorial_summary
      : typeof data.editorialSummary === "string"
        ? data.editorialSummary
        : "Model audit completed. Review the JSON details below before taking editorial action.";

  return {
    actionTag,
    domainSignalImpact,
    confidence,
    humanReviewRequired:
      typeof data.human_review_required === "boolean"
        ? data.human_review_required
        : typeof data.humanReviewRequired === "boolean"
          ? data.humanReviewRequired
          : confidence !== "High",
    recommendations:
      recommendations.length > 0
        ? recommendations
        : ["[EDITORIAL_REVIEW] Review output before applying article-level action."],
    editorialSummary,
    json: data,
  };
}

function normalizeEnum<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
}
