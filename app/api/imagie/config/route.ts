import { auth } from "@/app/(auth)/auth";
import { getRunpodSetting } from "@/lib/db/queries";
import { POD_PORTS, podProxyUrl } from "@/lib/imagie/runpod";

// Client bootstrap: the pod proxy base URL for direct backend calls, plus
// whether power control is configured. The RunPod API key is never included.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = await getRunpodSetting();
  const podId = row?.podId ?? null;

  return Response.json({
    hasRunpodKey: Boolean(row?.apiKey),
    imagieBaseUrl: podId ? podProxyUrl(podId, POD_PORTS.image) : null,
    podId,
  });
}
