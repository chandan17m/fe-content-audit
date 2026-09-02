import { saveFeedback } from "@/lib/audit-store";
import { createClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return Response.json({ message: "Login is required." }, { status: 401 });
  }

  const body = (await request.json()) as {
    runId?: string;
    feedback?: string;
    expected?: string;
  };

  if (!body.feedback?.trim()) {
    return Response.json({ message: "Feedback is required." }, { status: 400 });
  }

  const report = await saveFeedback({
    runId: body.runId,
    userEmail: user.email,
    feedback: body.feedback,
    expected: body.expected,
  });

  return Response.json({
    id: report.id,
    runId: body.runId ?? null,
    status: report.status,
    receivedAt: report.created_at,
  });
}
