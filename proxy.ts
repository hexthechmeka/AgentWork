import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { ACCESS_COOKIE, sha256Hex } from "./lib/access-gate";
import { guestRegex, isDevelopmentEnvironment } from "./lib/constants";

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

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: !isDevelopmentEnvironment,
  });

  if (!token) {
    const redirectUrl = encodeURIComponent(new URL(request.url).pathname);

    return NextResponse.redirect(
      new URL(`${base}/api/auth/guest?redirectUrl=${redirectUrl}`, request.url)
    );
  }

  const isGuest = guestRegex.test(token?.email ?? "");

  if (token && !isGuest && ["/login", "/register"].includes(pathname)) {
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
