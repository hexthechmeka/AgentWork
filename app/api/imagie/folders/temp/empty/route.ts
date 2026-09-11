import { auth } from "@/app/(auth)/auth";
import {
  deleteImageRows,
  ensureSystemFolders,
  listImages,
} from "@/lib/db/queries";
import { getMediaStorage } from "@/lib/imagie/storage";

export const maxDuration = 120;

// Manual "임시 폴더 비우기" — deletes every image currently in the calling
// user's own "임시" folder (+ blobs), not just expired ones. Scoped to the
// system temp folder only (no folderId param) so this can't be pointed at
// any other folder.
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { tempId } = await ensureSystemFolders(userId);
  const rows = await listImages({ folderId: tempId, limit: 1000, userId });

  if (rows.length === 0) {
    return Response.json({ deleted: 0, ok: true });
  }

  const storage = getMediaStorage();
  await Promise.all(
    rows.flatMap((r) => [storage.delete(r.blobUrl), storage.delete(r.thumbUrl)])
  );
  await deleteImageRows(
    rows.map((r) => r.id),
    userId
  );

  return Response.json({ deleted: rows.length, ok: true });
}
