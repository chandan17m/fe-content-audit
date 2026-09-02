import { isAllowedEmail } from "@/lib/auth";
import { isAdminEmail, upsertAccessUser, type UserRole } from "@/lib/audit-store";
import { createClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!(await isAdminEmail(user?.email).catch(() => false))) {
    return Response.json({ message: "Admin access is required." }, { status: 403 });
  }

  const body = (await request.json()) as { email?: string; role?: UserRole };
  const email = body.email?.trim().toLowerCase();
  const role = body.role === "admin" ? "admin" : "user";

  if (!email || !email.includes("@")) {
    return Response.json({ message: "Enter a valid employee email." }, { status: 400 });
  }

  if (!isAllowedEmail(email)) {
    return Response.json(
      { message: "Only indianexpress.com and financialexpress.com email IDs are allowed." },
      { status: 400 },
    );
  }

  const access = await upsertAccessUser({
    adminEmail: user?.email ?? "unknown",
    email,
    role,
  });

  return Response.json({ access });
}
