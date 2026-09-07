import "server-only";

import {
  deleteImageRows,
  expiredTempImages,
  tempOverflowImages,
} from "@/lib/db/queries";
import { getMediaStorage } from "./storage";

async function purge(
  rows: Array<{ id: string; blobUrl: string; thumbUrl: string }>
): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }
  const storage = getMediaStorage();
  await Promise.all(
    rows.flatMap((r) => [storage.delete(r.blobUrl), storage.delete(r.thumbUrl)])
  );
  await deleteImageRows(rows.map((r) => r.id));
  return rows.length;
}

/**
 * Enforce the 200-image cap on "임시" — call right after a save. Deletes the
 * oldest overflow rows and their blobs. Returns how many were removed.
 */
export function trimTempFolder(): Promise<number> {
  return tempOverflowImages().then(purge);
}

/**
 * Delete "임시" images past their 7-day TTL (+ blobs). Called by the cron.
 * Images moved out of "임시" have `expiresAt = NULL` and are never matched.
 */
export function purgeExpired(): Promise<number> {
  return expiredTempImages().then(purge);
}
