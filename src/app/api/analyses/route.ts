import { deleteAnalysis, getSavedAnalyses, isAdminEmail } from "@/lib/audit-store";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ message: "Login is required." }, { status: 401 });
  }

  const analyses = await getSavedAnalyses().catch(() => []);
  const isAdmin = await isAdminEmail(user.email).catch(() => false);

  return Response.json({ analyses, isAdmin });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!(await isAdminEmail(user?.email).catch(() => false))) {
    return Response.json({ message: "Admin access is required." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ message: "Analysis ID is required." }, { status: 400 });
  }

  await deleteAnalysis(id);

  return Response.json({ status: "deleted" });
}
