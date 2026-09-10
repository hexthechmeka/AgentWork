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

function buildCredential() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    return cert({
      clientEmail,
      // Service-account keys are stored as a single-line env var with
      // literal "\n" sequences standing in for real newlines.
      privateKey: privateKey.replace(/\\n/g, "\n"),
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
