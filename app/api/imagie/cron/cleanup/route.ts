import { connection } from "next/server";
import { purgeExpired } from "@/lib/imagie/cleanup";

// Vercel Cron (see vercel.json) — daily (Hobby plan allows daily only).
// Deletes "임시" images past their 7-day TTL and their blobs. Images moved to
// any other folder have expiresAt = NULL and are never touched. The 200-item
// cap is enforced synchronously on every save, so this is just the TTL sweep.
export async function GET(request: Request) {
  // Keep this off the build-time prerender path (nextConfig.cacheComponents).
  await connection();

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error(
      "[imagie] cron cleanup blocked: CRON_SECRET is not set (fails closed)"
    );
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const removed = await purgeExpired();
    return Response.json({ ok: true, removed });
  } catch (error) {
    console.error("[imagie] cron cleanup failed:", error);
    return Response.json({ error: "cleanup failed" }, { status: 500 });
  }
}
