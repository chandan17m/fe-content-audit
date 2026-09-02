import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/auth";
import { getAppUserByEmail, getOrCreateAppUser } from "@/lib/audit-store";
import { createClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/?auth_error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/?auth_error=session_exchange_failed`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const existingAccess = await getAppUserByEmail(user?.email).catch(() => null);

  if (!isAllowedEmail(user?.email) && !existingAccess) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/?auth_error=domain_not_allowed`);
  }

  if (user) {
    await getOrCreateAppUser({ id: user.id, email: user.email }).catch(() => null);
  }

  return NextResponse.redirect(origin);
}
