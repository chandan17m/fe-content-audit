import { Clock3, ShieldCheck } from "lucide-react";
import { getAllowedEmailDomains } from "@/lib/auth";

export function LoginScreen({ authError }: { authError?: string }) {
  const domains = getAllowedEmailDomains();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-5 py-10 text-slate-950">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-teal-50 text-teal-700">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-normal">FE Content Audit</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Sign in with your approved Google Workspace account to open the audit pipeline.
        </p>

        {authError ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {formatAuthError(authError)}
          </div>
        ) : null}

        <a
          href="/auth/sign-in"
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Continue with Google
        </a>

        <div className="mt-5 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-medium text-slate-900">Allowed domains</p>
          <p className="mt-1">{domains.map((domain) => `@${domain}`).join(", ")}</p>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <Clock3 className="h-3.5 w-3.5" />
          <span>IST clock appears after login.</span>
        </div>
      </section>
    </main>
  );
}

function formatAuthError(error: string) {
  if (error === "domain_not_allowed") {
    return "This Google account is not from an approved domain.";
  }

  if (error === "signin_failed") {
    return "Google sign-in could not be started. Check Supabase OAuth configuration.";
  }

  return "Sign-in could not be completed. Please try again.";
}
