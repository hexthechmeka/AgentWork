import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { AdminProxyError, adminFetch } from "@/lib/imagie/admin-proxy";

function fail(e: unknown) {
  if (e instanceof AdminProxyError) {
    return Response.json({ error: e.message }, { status: e.status });
  }
  return Response.json({ error: "admin proxy failed" }, { status: 500 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const catalog = await adminFetch(session.user.id, "/catalog/hf_models");
    return Response.json({ catalog });
  } catch (e) {
    return fail(e);
  }
}

const addSchema = z.object({
  model_id: z.string().min(1).max(200),
  name: z.string().min(1).max(120),
  prediction: z.literal("v_prediction").nullish(),
  type: z.enum(["SD", "SDXL", "FLUX"]),
  verify: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: z.infer<typeof addSchema>;
  try {
    body = addSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  try {
    const result = await adminFetch(session.user.id, "/catalog/hf_models", {
      body: JSON.stringify(body),
      method: "POST",
    });
    return Response.json(result);
  } catch (e) {
    return fail(e);
  }
}
