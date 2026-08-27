import { buildPrototypeOutput, cleanArticleText } from "@/lib/pipeline";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    content?: string;
    headline?: string;
    authorName?: string;
  };

  const cleaned = cleanArticleText(body.content ?? "");
  const output = buildPrototypeOutput(cleaned);

  return Response.json({
    runId: crypto.randomUUID(),
    status: "complete",
    cleaned,
    output,
    completedAt: new Date().toISOString(),
  });
}
