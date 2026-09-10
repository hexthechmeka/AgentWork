export const isProductionEnvironment = process.env.NODE_ENV === "production";
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT
);

// The account that server-to-server calls (the Vultr dev agent's usage
// logging/limit checks — no user session in that context) attribute usage
// to. No longer used for cookieless-visitor auto-login (Firebase Auth +
// ADMIN_EMAILS replaced that entirely — see app/(auth)/auth.ts, proxy.ts).
export const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "owner@agentwork.local";

// Comma-separated allowlist of emails that get isAdmin=true on Firebase
// sign-in/upsert (see upsertFirebaseUser in lib/db/queries.ts). Recomputed
// on every login, so editing this env var re-syncs isAdmin without a manual
// migration.
const adminEmailsRaw = process.env.ADMIN_EMAILS ?? "";
export const ADMIN_EMAILS = new Set(
  adminEmailsRaw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

export function isAdminEmail(email?: string | null) {
  return Boolean(email) && ADMIN_EMAILS.has((email ?? "").toLowerCase());
}

export const suggestions = [
  "What are the advantages of using Next.js?",
  "Write code to demonstrate Dijkstra's algorithm",
  "Help me write an essay about Silicon Valley",
  "What is the weather in San Francisco?",
];
