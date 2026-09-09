import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { getProjectById } from "@/lib/db/queries";
import { VultrUnconfiguredError, vultrFetch } from "@/lib/dev/vultr";

const bodySchema = z.object({
  instruction: z.string().min(1).max(20_000),
  projectId: z.string().uuid(),
});

// Browser -> Vercel -> Vultr. Kicks off a dev-agent job and hands back the
// jobId; the browser then opens /api/dev/stream/{jobId} for progress.
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

  const project = await getProjectById({ id: body.projectId });
  if (!project || project.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const res = await vultrFetch("/run", {
      body: JSON.stringify({
        instruction: body.instruction,
        projectId: body.projectId,
      }),
      method: "POST",
    });
    const text = await res.text();
    if (!res.ok) {
      return new Response(text || "vultr /run failed", { status: res.status });
    }
    return new Response(text, {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof VultrUnconfiguredError) {
      return Response.json({ error: e.message }, { status: 503 });
    }
    return Response.json(
      { error: "Vultr 서버에 연결하지 못했습니다" },
      { status: 502 }
    );
  }
}
