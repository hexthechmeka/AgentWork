import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { getRunpodSetting, upsertRunpodSetting } from "@/lib/db/queries";
import { derivePodId } from "@/lib/imagie/runpod";

async function requireUser() {
  const session = await auth();
  return session?.user ? session : null;
}

export async function GET() {
  if (!(await requireUser())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const row = await getRunpodSetting();
  return Response.json({
    hasRunpodKey: Boolean(row?.apiKey),
    podId: row?.podId ?? null,
  });
}

const bodySchema = z.object({
  // Empty string clears the key; omit to leave it unchanged.
  apiKey: z.string().max(400).optional(),
  // Full proxy URL or bare id both accepted; parsed to the id.
  podId: z.string().max(200).nullish(),
});

export async function PUT(request: Request) {
  if (!(await requireUser())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const patch: { podId?: string | null; apiKey?: string | null } = {};

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

  if (body.apiKey !== undefined) {
    patch.apiKey = body.apiKey.trim() === "" ? null : body.apiKey.trim();
  }

  await upsertRunpodSetting(patch);
  const row = await getRunpodSetting();
  return Response.json({
    hasRunpodKey: Boolean(row?.apiKey),
    podId: row?.podId ?? null,
  });
}
