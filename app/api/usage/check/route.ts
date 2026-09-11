import { getOwnerUser, isProviderHardLocked } from "@/lib/db/queries";
import { vultrSecretError } from "@/lib/dev/vultr";

// Called server-to-server by the Vultr dev agent before every GLM call.
// With BYOK, `userId` (the actual requester, echoed back from /run) is the
// normal path — each account only hard-locks against its own usage. The
// getOwnerUser() fallback covers older/misconfigured callers that omit it.
const PROVIDERS = new Set(["anthropic", "glm", "aichat"]);

export async function GET(request: Request) {
  const unauthorized = vultrSecretError(request);
  if (unauthorized) {
    return unauthorized;
  }

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider") ?? "";
  if (!PROVIDERS.has(provider)) {
    return Response.json({ error: "bad provider" }, { status: 400 });
  }

  const userId = searchParams.get("userId") || (await getOwnerUser())?.id;
  if (!userId) {
    // Neither an explicit userId nor an owner account exists yet —
    // nothing to block against.
    return Response.json({ blocked: false });
  }
  const blocked = await isProviderHardLocked({
    provider: provider as "anthropic" | "glm" | "aichat",
    userId,
  });
  return Response.json({ blocked });
}
