import { z } from "zod";
import { trackUsage } from "@/lib/ai/usage";
import { getOwnerUser } from "@/lib/db/queries";
import { vultrSecretError } from "@/lib/dev/vultr";

// Called (fire-and-forget) by the Vultr dev agent after each GLM call. With
// BYOK, `userId` (the actual requester, echoed back from /run) is the normal
// path so usage lands on that account's own dashboard. The getOwnerUser()
// fallback covers older/misconfigured callers that omit it.
const bodySchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  model: z.string().min(1).max(200),
  outputTokens: z.number().int().nonnegative(),
  // TODO(dev-agent): UsageEvent has no projectId column — accepted, unused.
  projectId: z.string().optional(),
  provider: z.literal("glm"),
  userId: z.string().uuid().optional(),
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

  const userId = body.userId ?? (await getOwnerUser())?.id;
  if (!userId) {
    // Neither an explicit userId nor an owner account exists yet —
    // nothing to attribute to.
    return Response.json({ ok: true, skipped: "no user to attribute to" });
  }
  await trackUsage({
    modelId: body.model.startsWith("glm/") ? body.model : `glm/${body.model}`,
    usage: { inputTokens: body.inputTokens, outputTokens: body.outputTokens },
    userId,
  });
  return Response.json({ ok: true });
}
