import { getAdminDashboard, isAdminEmail } from "@/lib/audit-store";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!(await isAdminEmail(user?.email).catch(() => false))) {
    return Response.json({ message: "Admin access is required." }, { status: 403 });
  }

  const dashboard = await getAdminDashboard();

  return Response.json(dashboard);
}
