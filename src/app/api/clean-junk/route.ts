import { cleanArticleText } from "@/lib/pipeline";

export async function POST(request: Request) {
  const body = (await request.json()) as { content?: string };

  return Response.json({
    cleaned: cleanArticleText(body.content ?? ""),
    cleanedAt: new Date().toISOString(),
  });
}
