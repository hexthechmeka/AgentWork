import "server-only";

import {
  deleteImageRows,
  expiredTempImages,
  hardDeleteImageRows,
  tempOverflowImages,
} from "@/lib/db/queries";
import { getMediaStorage } from "./storage";

type PurgeRow = { id: string; blobUrl: string; thumbUrl: string };

async function purge(rows: PurgeRow[], userId?: string): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }
  const storage = getMediaStorage();
  await Promise.all(
    rows.flatMap((r) => [storage.delete(r.blobUrl), storage.delete(r.thumbUrl)])
  );
  const ids = rows.map((r) => r.id);
  if (userId) {
    await deleteImageRows(ids, userId);
  } else {
    await hardDeleteImageRows(ids);
  }
  return rows.length;
}

/**
 * Enforce the 200-image cap on this account's "임시" — call right after a
 * save. Deletes the oldest overflow rows and their blobs. Returns how many
 * were removed.
 */
export function trimTempFolder(userId: string): Promise<number> {
  return tempOverflowImages(userId).then((rows) => purge(rows, userId));
}

/**
 * Delete every account's "임시" images past their 7-day TTL (+ blobs).
 * Called by the daily cron. `expiresAt` is non-null only while an image is
 * in a temp folder (cleared on move), so this is a safe global sweep.
 */
export function purgeExpired(): Promise<number> {
  return expiredTempImages().then((rows) => purge(rows));
}
