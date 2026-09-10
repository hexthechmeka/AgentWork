import "server-only";

// Firebase Admin SDK singleton. Node.js-runtime server code only (route
// handlers, the auth() module) — never import this from proxy.ts (Edge
// runtime) or from a Client Component. For the browser-side SDK, use
// lib/firebase/client.ts instead.
//
// Lazily initialized: no real Firebase project is configured in every
// environment (e.g. a build/CI run with no FIREBASE_* vars or ADC
// available), and initializeApp/applicationDefault throw immediately in
// that case, which would break `next build`'s static analysis of any route
// that imports this module. Deferring to first call means the throw only
// happens if something actually tries to verify a cookie/token without
// Firebase configured.

import {
  type App,
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { type Auth, getAuth } from "firebase-admin/auth";

// Turns whatever is in FIREBASE_PRIVATE_KEY into a real PEM string.
// Handles the usual env-var mangling: wrapping quotes, literal "\n" (single
// or double-escaped), and \r\n.
function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  return key
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n");
}

function logKeyShape(raw: string | undefined) {
  if (!raw) {
    console.error("FIREBASE_PRIVATE_KEY is not set");
    return;
  }
  // The PEM header is not secret; the body is never logged.
  console.log("FIREBASE_PRIVATE_KEY shape:", {
    endsWithFooter: raw.trimEnd().endsWith("-----END PRIVATE KEY-----"),
    hasDoubleEscaped: raw.includes("\\\\n"),
    hasLiteralBackslashN: raw.includes("\\n"),
    hasRealNewline: raw.includes("\n"),
    len: raw.length,
    looksLikeJson: raw.trimStart().startsWith("{"),
    quoted: raw.startsWith('"') || raw.startsWith("'"),
    startsWith: raw.slice(0, 27),
  });
}

function buildCredential() {
  // Option A: the entire downloaded service-account JSON in one env var —
  // sidesteps all the private-key newline mangling.
  const jsonRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (jsonRaw?.trim().startsWith("{")) {
    const parsed = JSON.parse(jsonRaw) as {
      client_email: string;
      private_key: string;
      project_id: string;
    };
    return cert({
      clientEmail: parsed.client_email,
      privateKey: normalizePrivateKey(parsed.private_key),
      projectId: parsed.project_id,
    });
  }

  // Option B: the three discrete vars.
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    logKeyShape(privateKey);
    return cert({
      clientEmail,
      privateKey: normalizePrivateKey(privateKey),
      projectId,
    });
  }

  // Local dev fallback: GOOGLE_APPLICATION_CREDENTIALS pointing at a
  // downloaded service-account JSON file.
  return applicationDefault();
}

let cachedApp: App | null = null;
function getAdminApp(): App {
  if (!cachedApp) {
    cachedApp =
      getApps()[0] ?? initializeApp({ credential: buildCredential() });
  }
  return cachedApp;
}

let cachedAuth: Auth | null = null;
export function getAdminAuth(): Auth {
  if (!cachedAuth) {
    cachedAuth = getAuth(getAdminApp());
  }
  return cachedAuth;
}
