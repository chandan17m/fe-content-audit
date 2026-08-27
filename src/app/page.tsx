import { AuditWorkspace } from "@/components/audit-workspace";
import { LoginScreen } from "@/components/login-screen";
import { isAllowedEmail } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";

export default async function Home({ searchParams }: PageProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const params = await searchParams;
  const authError = typeof params.auth_error === "string" ? params.auth_error : undefined;

  if (!user || !isAllowedEmail(user.email)) {
    return <LoginScreen authError={authError} />;
  }

  return <AuditWorkspace userEmail={user.email ?? "unknown"} />;
}
