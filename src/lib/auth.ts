export function getAllowedEmailDomains() {
  return (process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmail(email?: string | null) {
  if (!email) {
    return false;
  }

  const domain = email.split("@").at(1)?.toLowerCase();
  return Boolean(domain && getAllowedEmailDomains().includes(domain));
}
