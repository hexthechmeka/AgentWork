import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { AdminProxyError, adminFetch } from "@/lib/imagie/admin-proxy";

// The pod downloads the file server-side, so only the URL crosses this
// function (multi-GB files never touch Vercel).
export const maxDuration = 300;

const bodySchema = z.object({
  filename: z.string().min(1).max(200),
  kind: z.enum(["checkpoints", "loras", "embeddings"]),
  url: z.string().url(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  try {
    const result = await adminFetch(session.user.id, `/${body.kind}/from_url`, {
      body: JSON.stringify({ filename: body.filename, url: body.url }),
      method: "POST",
    });
    return Response.json(result);
  } catch (e) {
    if (e instanceof AdminProxyError) {
      return Response.json({ error: e.message }, { status: e.status });
    }
    return Response.json({ error: "admin proxy failed" }, { status: 500 });
  }
}
