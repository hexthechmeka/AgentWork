import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  ensureSystemFolders,
  IMAGIE_TEMP_TTL_MS,
  insertImages,
  listImages,
  type NewImagieImage,
} from "@/lib/db/queries";
import { trimTempFolder } from "@/lib/imagie/cleanup";
import { decodeDataUrl, getMediaStorage, imageKey } from "@/lib/imagie/storage";
import { generateUUID } from "@/lib/utils";

// Blob uploads for a whole batch can take a while.
export const maxDuration = 300;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const folderId = url.searchParams.get("folderId");
  if (!folderId) {
    return Response.json({ error: "folderId required" }, { status: 400 });
  }
  const limit = Number(url.searchParams.get("limit") ?? 200);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const images = await listImages({
    folderId,
    limit,
    offset,
    userId: session.user.id,
  });
  return Response.json({ images });
}

const persistSchema = z.object({
  images: z
    .array(
      z.object({
        metadata: z.record(z.string(), z.unknown()).optional(),
        png: z.string().min(1),
        seed: z.number().nullable().optional(),
        thumb: z.string().min(1),
      })
    )
    .min(1)
    .max(100),
  params: z.object({
    guidanceScale: z.number(),
    height: z.number().int(),
    modelName: z.string().min(1),
    negativePrompt: z.string().default(""),
    prompt: z.string().default(""),
    sampler: z.string().default(""),
    steps: z.number().int(),
    width: z.number().int(),
  }),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof persistSchema>;
  try {
    body = persistSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const userId = session.user.id;
  const { tempId } = await ensureSystemFolders(userId);
  const storage = getMediaStorage();
  const p = body.params;
  const expiresAt = new Date(Date.now() + IMAGIE_TEMP_TTL_MS);

  const rows: NewImagieImage[] = await Promise.all(
    body.images.map(async (img) => {
      const id = generateUUID();
      const png = decodeDataUrl(img.png);
      const thumb = decodeDataUrl(img.thumb);
      const [blobUrl, thumbUrl] = await Promise.all([
        storage.upload(png.buffer, imageKey("orig", id), "image/png"),
        storage.upload(thumb.buffer, imageKey("thumb", id), "image/jpeg"),
      ]);
      return {
        blobUrl,
        expiresAt,
        folderId: tempId,
        guidanceScale: String(p.guidanceScale),
        height: p.height,
        id,
        metadata: img.metadata ?? {},
        modelName: p.modelName,
        negativePrompt: p.negativePrompt,
        prompt: p.prompt,
        sampler: p.sampler,
        seed: img.seed ?? null,
        steps: p.steps,
        thumbUrl,
        userId,
        width: p.width,
      };
    })
  );

  await insertImages(rows);
  const trimmed = await trimTempFolder(userId).catch(() => 0);

  return Response.json({
    images: rows.map((r) => ({
      blobUrl: r.blobUrl,
      id: r.id,
      seed: r.seed,
      thumbUrl: r.thumbUrl,
    })),
    trimmed,
  });
}
