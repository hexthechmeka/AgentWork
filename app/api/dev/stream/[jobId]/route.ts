import { auth } from "@/app/(auth)/auth";
import { VultrUnconfiguredError, vultrFetch } from "@/lib/dev/vultr";

// Plain passthrough of Vultr's SSE stream — the upstream ReadableStream is
// handed straight to the client, no buffering. Route handlers run on the
// Node runtime by default; `auth()` + `params` already make this dynamic.
type Ctx = { params: Promise<{ jobId: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { jobId } = await params;
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(jobId)) {
    return Response.json({ error: "bad jobId" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await vultrFetch(`/stream/${jobId}`, {
      headers: { Accept: "text/event-stream" },
    });
  } catch (e) {
    if (e instanceof VultrUnconfiguredError) {
      return Response.json({ error: e.message }, { status: 503 });
    }
    return Response.json({ error: "Vultr 연결 실패" }, { status: 502 });
  }

  if (!(upstream.ok && upstream.body)) {
    return new Response(await upstream.text(), {
      status: upstream.status || 502,
    });
  }

  return new Response(upstream.body, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    },
  });
}
