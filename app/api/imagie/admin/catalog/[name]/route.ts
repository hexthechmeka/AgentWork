import { auth } from "@/app/(auth)/auth";
import { AdminProxyError, adminFetch } from "@/lib/imagie/admin-proxy";

type Ctx = { params: Promise<{ name: string }> };

export async function DELETE(_request: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { name } = await params;
  try {
    const result = await adminFetch(
      session.user.id,
      `/catalog/hf_models/${encodeURIComponent(name)}`,
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
