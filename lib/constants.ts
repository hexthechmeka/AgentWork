import { generateDummyPassword } from "./db/utils";

export const isProductionEnvironment = process.env.NODE_ENV === "production";
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT
);

export const guestRegex = /^guest-\d+$/;

// The single stable account every cookieless session resolves to on a
// private deployment. Keep in sync with the default in lib/db/queries.ts.
export const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "owner@agentwork.local";

export function isAnonymousEmail(email?: string | null) {
  return (
    Boolean(email) && (email === OWNER_EMAIL || guestRegex.test(email ?? ""))
  );
}

export const DUMMY_PASSWORD = generateDummyPassword();

export const suggestions = [
  "What are the advantages of using Next.js?",
  "Write code to demonstrate Dijkstra's algorithm",
  "Help me write an essay about Silicon Valley",
  "What is the weather in San Francisco?",
];
