import { auth } from "@/app/(auth)/auth";
import { getRunpodSetting } from "@/lib/db/queries";
import { POD_PORTS, portResponds, stopPod } from "@/lib/imagie/runpod";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = await getRunpodSetting();
  if (!(row?.podId && row.apiKey)) {
    return Response.json(
      { error: "Pod ID와 RunPod API 키를 먼저 설정하세요" },
      { status: 503 }
    );
  }

  // Server-side guard (spec §4.4): don't stop until the pod has actually
  // come alive — a mid-boot stop can wedge it. Client disables the button
  // too, but this is the enforced check.
  const [image, text, jupyter] = await Promise.all([
    portResponds(row.podId, POD_PORTS.image),
    portResponds(row.podId, POD_PORTS.text),
    portResponds(row.podId, POD_PORTS.jupyter),
  ]);
  if (!(image || text || jupyter)) {
    return Response.json(
      {
        error:
          "Pod이 아직 완전히 기동되지 않았습니다. 잠시 후 다시 시도하세요.",
      },
      { status: 409 }
    );
  }

  try {
    const status = await stopPod(row.podId, row.apiKey);
    return Response.json({ desiredStatus: status.desiredStatus, ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "stop failed" },
      { status: 502 }
    );
  }
}
