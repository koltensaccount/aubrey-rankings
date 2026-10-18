type AdminSession = { user?: { id?: string; email?: string; emailVerified?: boolean } } | null;

// Fail closed in every environment. Email grants require verified ownership.
export function checkIsAdmin(session: AdminSession, env: Record<string, string | undefined> = process.env): boolean {
  if (!session?.user) return false;
  const ids = (env.ADMIN_USER_IDS ?? "").split(",").map(v => v.trim()).filter(Boolean);
  const emails = (env.ADMIN_EMAILS ?? "").split(",").map(v => v.trim().toLowerCase()).filter(Boolean);
  return Boolean(
    (session.user.id && ids.includes(session.user.id)) ||
    (session.user.emailVerified === true && session.user.email && emails.includes(session.user.email.toLowerCase()))
  );
}
