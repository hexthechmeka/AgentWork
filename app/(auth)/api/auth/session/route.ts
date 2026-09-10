import { cookies } from "next/headers";
import { upsertFirebaseUser } from "@/lib/db/queries";
import { getAdminAuth } from "@/lib/firebase/admin";
import {
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@/lib/firebase/session";

// Exchanges a Firebase ID token (obtained client-side via
// lib/firebase/client.ts) for an httpOnly session cookie. This cookie IS
// the session that app/(auth)/auth.ts's auth() verifies — replaces
// NextAuth's JWT cookie entirely.
function stepError(step: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`/api/auth/session POST failed at ${step}:`, error);
  return Response.json({ error: message, step }, { status: 500 });
}

export async function POST(request: Request) {
  const { idToken } = (await request.json()) as { idToken?: string };

  if (!idToken) {
    return Response.json({ error: "Missing idToken" }, { status: 400 });
  }

  let adminAuth: ReturnType<typeof getAdminAuth>;
  try {
    adminAuth = getAdminAuth();
  } catch (error) {
    // Missing/invalid FIREBASE_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY.
    return stepError("admin-sdk-init", error);
  }

  let decoded: Awaited<ReturnType<typeof adminAuth.verifyIdToken>>;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch (error) {
    console.error("Firebase ID token verification failed:", error);
    return Response.json({ error: "Invalid idToken" }, { status: 401 });
  }

  if (!decoded.email) {
    return Response.json(
      { error: "Firebase account has no email" },
      { status: 400 }
    );
  }

  try {
    await upsertFirebaseUser({
      email: decoded.email,
      firebaseUid: decoded.uid,
      image: decoded.picture,
      name: decoded.name,
    });
  } catch (error) {
    // DB unreachable, or migration 0012 (firebaseUid/isAdmin) not applied.
    return stepError("upsert-user", error);
  }

  let sessionCookie: string;
  try {
    sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_COOKIE_MAX_AGE_SECONDS * 1000,
    });
  } catch (error) {
    // Usually a malformed FIREBASE_PRIVATE_KEY, or the service account
    // lacks the "Service Account Token Creator" role.
    return stepError("create-session-cookie", error);
  }

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, sessionCookie, sessionCookieOptions);

  return Response.json({ ok: true });
}

// Signs out: revokes the Firebase refresh tokens tied to this session (so
// the cookie can't be replayed before its natural expiry) and clears it.
export async function DELETE() {
  const store = await cookies();
  const cookie = store.get(SESSION_COOKIE_NAME)?.value;

  if (cookie) {
    try {
      const adminAuth = getAdminAuth();
      const decoded = await adminAuth.verifySessionCookie(cookie);
      await adminAuth.revokeRefreshTokens(decoded.uid);
    } catch {
      // Cookie already invalid/expired — nothing to revoke, still clear it.
    }
  }

  store.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions, maxAge: 0 });

  return Response.json({ ok: true });
}
