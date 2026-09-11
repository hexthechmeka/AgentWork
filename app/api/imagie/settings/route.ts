import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { getRunpodSetting, upsertRunpodSetting } from "@/lib/db/queries";
import { derivePodId } from "@/lib/imagie/runpod";

async function requireUser() {
  const session = await auth();
  return session?.user ? session : null;
}

export async function GET() {
  const session = await requireUser();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const row = await getRunpodSetting(session.user.id);
  return Response.json({
    hasRunpodKey: Boolean(row?.apiKey),
    podId: row?.podId ?? null,
  });
}

const bodySchema = z.object({
  // Full proxy URL or bare id both accepted; parsed to the id. The RunPod
  // API key itself is set via PUT /api/settings/credentials now (BYOK) —
  // this route only owns podId.
  podId: z.string().max(200).nullish(),
});

export async function PUT(request: Request) {
  const session = await requireUser();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const patch: { podId?: string | null } = {};

  if (body.podId !== undefined) {
    if (body.podId === null || body.podId.trim() === "") {
      patch.podId = null;
    } else {
      const parsed = derivePodId(body.podId);
      if (!parsed) {
        return Response.json(
          {
            error:
              "Pod ID를 인식하지 못했습니다 (xxxx 또는 xxxx-8000.proxy.runpod.net)",
          },
          { status: 400 }
        );
      }
      patch.podId = parsed;
    }
  }

  await upsertRunpodSetting(session.user.id, patch);
  const row = await getRunpodSetting(session.user.id);
  return Response.json({
    hasRunpodKey: Boolean(row?.apiKey),
    podId: row?.podId ?? null,
  });
}
