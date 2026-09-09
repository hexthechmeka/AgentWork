import { auth } from "@/app/(auth)/auth";
import { getRunpodSetting } from "@/lib/db/queries";
import {
  getPodStatus,
  imageApiReady,
  POD_PORTS,
  portResponds,
} from "@/lib/imagie/runpod";

// Pod power + reachability. `alive` (any of 8000/8001/8888 answers) unlocks
// the Stop button; `generateReady` (8000 /api/health 200) unlocks Generate.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = await getRunpodSetting(session.user.id);
  const podId = row?.podId ?? null;
  if (!podId) {
    return Response.json({
      configured: false,
      hasRunpodKey: Boolean(row?.apiKey),
    });
  }

  const [image, text, jupyter, generateReady, podStatus] = await Promise.all([
    portResponds(podId, POD_PORTS.image),
    portResponds(podId, POD_PORTS.text),
    portResponds(podId, POD_PORTS.jupyter),
    imageApiReady(podId),
    row?.apiKey
      ? getPodStatus(podId, row.apiKey).catch(() => null)
      : Promise.resolve(null),
  ]);

  return Response.json({
    alive: image || text || jupyter,
    configured: true,
    desiredStatus: podStatus?.desiredStatus ?? null,
    generateReady,
    hasRunpodKey: Boolean(row?.apiKey),
    podId,
    ports: { image, jupyter, text },
  });
}
