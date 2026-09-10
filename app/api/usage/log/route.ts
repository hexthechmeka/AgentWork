import { z } from "zod";
import { trackUsage } from "@/lib/ai/usage";
import { getOwnerUser } from "@/lib/db/queries";
import { vultrSecretError } from "@/lib/dev/vultr";

// Called (fire-and-forget) by the Vultr dev agent after each GLM call.
const bodySchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  model: z.string().min(1).max(200),
  outputTokens: z.number().int().nonnegative(),
  // TODO(dev-agent): UsageEvent has no projectId column — accepted, unused.
  projectId: z.string().optional(),
  provider: z.literal("glm"),
});

export async function POST(request: Request) {
  const unauthorized = vultrSecretError(request);
  if (unauthorized) {
    return unauthorized;
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const owner = await getOwnerUser();
  if (!owner) {
    // Owner hasn't signed in via Firebase yet — nothing to attribute to.
    return Response.json({ ok: true, skipped: "no owner user" });
  }
  await trackUsage({
    modelId: body.model.startsWith("glm/") ? body.model : `glm/${body.model}`,
    usage: { inputTokens: body.inputTokens, outputTokens: body.outputTokens },
    userId: owner.id,
  });
  return Response.json({ ok: true });
}
