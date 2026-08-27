export async function POST(request: Request) {
  const body = (await request.json()) as {
    runId?: string;
    feedback?: string;
    expected?: string;
  };

  return Response.json({
    id: crypto.randomUUID(),
    runId: body.runId ?? null,
    status: "pending_admin_review",
    receivedAt: new Date().toISOString(),
  });
}
