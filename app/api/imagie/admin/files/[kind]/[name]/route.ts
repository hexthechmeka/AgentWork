import { auth } from "@/app/(auth)/auth";
import { AdminProxyError, adminFetch } from "@/lib/imagie/admin-proxy";

type Ctx = { params: Promise<{ kind: string; name: string }> };

const KINDS = new Set(["loras", "embeddings"]);

// Checkpoint deletion stays on the backend's own /api/delete_model (it also
// frees the HF cache); this route covers loras / embeddings.
export async function DELETE(_request: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { kind, name } = await params;
  if (!KINDS.has(kind)) {
    return Response.json({ error: "지원하지 않는 종류" }, { status: 400 });
  }
  try {
    const result = await adminFetch(
      session.user.id,
      `/${kind}/${encodeURIComponent(name)}`,
      { method: "DELETE" }
    );
    return Response.json(result);
  } catch (e) {
    if (e instanceof AdminProxyError) {
      return Response.json({ error: e.message }, { status: e.status });
    }
    return Response.json({ error: "admin proxy failed" }, { status: 500 });
  }
}
