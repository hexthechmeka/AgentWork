import { getOrCreateOwnerUser, isProviderHardLocked } from "@/lib/db/queries";
import { vultrSecretError } from "@/lib/dev/vultr";

// Called server-to-server by the Vultr dev agent before every GLM call.
// Dev-agent usage is attributed to the owner account, so it shares the same
// `glm` hard-lock as chat.
const PROVIDERS = new Set(["anthropic", "glm", "aichat"]);

export async function GET(request: Request) {
  const unauthorized = vultrSecretError(request);
  if (unauthorized) {
    return unauthorized;
  }

  const provider = new URL(request.url).searchParams.get("provider") ?? "";
  if (!PROVIDERS.has(provider)) {
    return Response.json({ error: "bad provider" }, { status: 400 });
  }

  const [owner] = await getOrCreateOwnerUser();
  const blocked = await isProviderHardLocked({
    provider: provider as "anthropic" | "glm" | "aichat",
    userId: owner.id,
  });
  return Response.json({ blocked });
}
