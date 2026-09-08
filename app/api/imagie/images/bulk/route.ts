import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  bulkMoveImages,
  deleteImageRows,
  getFolderById,
  getImagesByIds,
} from "@/lib/db/queries";
import { getMediaStorage } from "@/lib/imagie/storage";

export const maxDuration = 120;

const bodySchema = z.discriminatedUnion("op", [
  z.object({
    folderId: z.string().uuid(),
    ids: z.array(z.string().uuid()).min(1).max(500),
    op: z.literal("move"),
  }),
  z.object({
    ids: z.array(z.string().uuid()).min(1).max(500),
    op: z.literal("delete"),
  }),
]);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  if (body.op === "move") {
    const target = await getFolderById(body.folderId);
    if (!target) {
      return Response.json({ error: "Folder not found" }, { status: 404 });
    }
    await bulkMoveImages(body.ids, body.folderId);
    return Response.json({ moved: body.ids.length, ok: true });
  }

  // delete: blobs first, then rows
  const rows = await getImagesByIds(body.ids);
  const storage = getMediaStorage();
  await Promise.all(
    rows.flatMap((r) => [storage.delete(r.blobUrl), storage.delete(r.thumbUrl)])
  );
  await deleteImageRows(body.ids);
  return Response.json({ deleted: rows.length, ok: true });
}
