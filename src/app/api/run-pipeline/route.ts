import { buildPrototypeOutput, cleanArticleText } from "@/lib/pipeline";
import { getModulePrompts } from "@/lib/server-prompts";

export async function POST(request: Request) {
  const prompts = await getModulePrompts();
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
    promptConfigured: Boolean(prompts.module1 && prompts.module2 && prompts.module3),
    completedAt: new Date().toISOString(),
  });
}
