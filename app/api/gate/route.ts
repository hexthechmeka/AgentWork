import { cookies } from "next/headers";
import { ACCESS_COOKIE, sha256Hex } from "@/lib/access-gate";

const ONE_YEAR = 60 * 60 * 24 * 365;

function safeRedirect(raw: string | null) {
  if (raw?.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }
  return "/";
}

export async function POST(request: Request) {
  const accessPassword = process.env.ACCESS_PASSWORD;

  // Gate disabled — nothing to do.
  if (!accessPassword) {
    return Response.redirect(new URL("/", request.url), 303);
  }

  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const redirectTo = safeRedirect(String(form.get("redirectUrl") ?? "/"));

  if (password !== accessPassword) {
    const url = new URL("/gate", request.url);
    url.searchParams.set("redirectUrl", redirectTo);
    url.searchParams.set("error", "1");
    return Response.redirect(url, 303);
  }

  const store = await cookies();
  store.set(ACCESS_COOKIE, await sha256Hex(accessPassword), {
    httpOnly: true,
    maxAge: ONE_YEAR,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return Response.redirect(new URL(redirectTo, request.url), 303);
}
