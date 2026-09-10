import "server-only";

import { cookies } from "next/headers";
import { getUserByFirebaseUid } from "@/lib/db/queries";
import { getAdminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE_NAME } from "@/lib/firebase/session";

// Vestigial: NextAuth's guest provider always returned type "regular" too,
// so hardcoding it here preserves prior behavior for the one remaining
// reader (app/(chat)/api/chat/route.ts). Safe to remove in a future
// cleanup once that call site is updated.
export type UserType = "guest" | "regular";

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  isAdmin: boolean;
  type: UserType;
};

export type Session = {
  user: SessionUser;
};

// User type from "next-auth" was previously re-exported implicitly via
// module augmentation; several components import { User } from "next-auth"
// for prop types. Export the same shape here so those imports can point at
// this module instead (see the Firebase Auth migration).
export type User = SessionUser;

/**
 * Verifies the Firebase session cookie (set by
 * app/(auth)/api/auth/session's POST handler) and resolves it to this
 * app's internal User row. Returns null if there's no cookie, it's
 * invalid/expired/revoked, or it points at a Firebase UID with no matching
 * internal User row (a stale/forged cookie — never auto-creates a row here;
 * creation only happens through the explicit session-exchange endpoint).
 */
export async function auth(): Promise<Session | null> {
  const store = await cookies();
  const sessionCookie = store.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return null;
  }

  let uid: string;
  try {
    const decoded = await getAdminAuth().verifySessionCookie(
      sessionCookie,
      /* checkRevoked */ true
    );
    ({ uid } = decoded);
  } catch {
    return null;
  }

  const [internalUser] = await getUserByFirebaseUid(uid);
  if (!internalUser) {
    return null;
  }

  return {
    user: {
      email: internalUser.email,
      id: internalUser.id,
      image: internalUser.image,
      isAdmin: internalUser.isAdmin,
      name: internalUser.name,
      type: "regular",
    },
  };
}
