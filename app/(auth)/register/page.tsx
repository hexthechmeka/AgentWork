import { redirect } from "next/navigation";

// Self-registration via email/password is gone with Firebase Auth: Google
// sign-in on /login auto-creates an account for any new user, and
// email/password sign-in is admin-only. Keep this route alive (rather than
// a 404) for anyone with a bookmarked/linked /register URL.
export default function Page() {
  redirect("/login");
}
