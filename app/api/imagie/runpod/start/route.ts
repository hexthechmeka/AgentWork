import { auth } from "@/app/(auth)/auth";
import { getRunpodSetting } from "@/lib/db/queries";
import { startPod } from "@/lib/imagie/runpod";

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

  try {
    const status = await startPod(row.podId, row.apiKey);
    return Response.json({ desiredStatus: status.desiredStatus, ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "start failed" },
      { status: 502 }
    );
  }
}
