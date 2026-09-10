import "server-only";

// Shared constants for the Firebase session-cookie pattern. The cookie
// itself IS the session — no NextAuth JWT runs alongside it.

export const SESSION_COOKIE_NAME = "agentwork_session";

// Firebase's createSessionCookie caps expiresIn at 14 days.
export const SESSION_COOKIE_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

export const sessionCookieOptions = {
  httpOnly: true,
  maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};
