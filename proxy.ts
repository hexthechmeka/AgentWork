import { type NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, sha256Hex } from "./lib/access-gate";
import { SESSION_COOKIE_NAME } from "./lib/firebase/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/ping")) {
    return new Response("pong", { status: 200 });
  }

  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  // Optional shared-password gate. Dormant unless ACCESS_PASSWORD is set.
  const accessPassword = process.env.ACCESS_PASSWORD;
  if (
    accessPassword &&
    !(
      pathname.startsWith("/gate") ||
      pathname.startsWith("/api/gate") ||
      pathname.startsWith("/api/auth")
    )
  ) {
    const expected = await sha256Hex(accessPassword);
    const provided = request.cookies.get(ACCESS_COOKIE)?.value;
    if (provided !== expected) {
      const redirectUrl = encodeURIComponent(
        request.nextUrl.pathname + request.nextUrl.search
      );
      return NextResponse.redirect(
        new URL(`${base}/gate?redirectUrl=${redirectUrl}`, request.url)
      );
    }
  }

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Vultr dev-agent server-to-server routes authenticate with a shared
  // secret inside the handler — no session cookie, so skip the login
  // redirect and let the handler return 401 if the secret is wrong.
  if (pathname === "/api/usage/check" || pathname === "/api/usage/log") {
    return NextResponse.next();
  }

  const isLoginPage = pathname === "/login" || pathname === "/register";

  // admin.auth().verifySessionCookie() needs the Admin SDK (Node crypto,
  // network calls to Google) — not Edge-safe. So this only checks whether
  // the cookie is present, not whether it's actually valid; real
  // verification happens in every route/layout's own auth() call (same
  // deferral pattern this app already uses for ownership checks — see the
  // data-isolation audit). A forged/expired cookie still gets rejected
  // there, just one hop later than here.
  const hasSessionCookie = Boolean(
    request.cookies.get(SESSION_COOKIE_NAME)?.value
  );

  if (!hasSessionCookie && !isLoginPage) {
    const redirectUrl = encodeURIComponent(
      request.nextUrl.pathname + request.nextUrl.search
    );
    return NextResponse.redirect(
      new URL(`${base}/login?redirect=${redirectUrl}`, request.url)
    );
  }

  if (hasSessionCookie && isLoginPage) {
    return NextResponse.redirect(new URL(`${base}/`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/chat/:id",
    "/api/:path*",
    "/login",
    "/register",

    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
