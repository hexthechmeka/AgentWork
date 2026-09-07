import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  deleteImageRows,
  getFolderById,
  getImageById,
  moveImageToFolder,
} from "@/lib/db/queries";
import { getMediaStorage } from "@/lib/imagie/storage";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({ folderId: z.string().uuid() });

// Move to a folder. Any folder but "임시" clears expiresAt (keeps forever).
export async function PATCH(request: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const image = await getImageById(id);
  if (!image) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const target = await getFolderById(body.folderId);
  if (!target) {
    return Response.json({ error: "Folder not found" }, { status: 404 });
  }
  await moveImageToFolder(id, body.folderId);
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const image = await getImageById(id);
  if (!image) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const storage = getMediaStorage();
  await Promise.all([
    storage.delete(image.blobUrl),
    storage.delete(image.thumbUrl),
  ]);
  await deleteImageRows([id]);
  return Response.json({ ok: true });
}
