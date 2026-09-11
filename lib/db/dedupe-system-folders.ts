import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

/**
 * One-off fix: lib/db/consolidate-to-admin.ts blindly repointed every
 * Folder.userId from the legacy accounts onto the admin, but each of those
 * accounts already had its own "미분류"/"임시" system folders — so the admin
 * ended up with 3 of each (same name, isSystem=true) instead of 1. The UI
 * only offers rename/delete for non-system folders, so the duplicates were
 * stuck: creatable-around but not deletable.
 *
 * For each (userId, name) group of isSystem folders with more than one row,
 * keeps the earliest-created one, moves every ImagieImage.folderId that
 * pointed at the others onto it, then deletes the now-empty duplicates.
 * Images are moved before their old folder row is deleted — ImagieImage's
 * folderId FK is ON DELETE CASCADE, so doing it the other way round would
 * silently destroy images.
 *
 * Run once:
 *   pnpm tsx lib/db/dedupe-system-folders.ts
 * Idempotent — a second run finds nothing to merge.
 */

const TARGET_EMAIL =
  process.env.CONSOLIDATE_TARGET_EMAIL ?? "hexthechmeka@gmail.com";

async function run() {
  if (!process.env.POSTGRES_URL) {
    console.log("POSTGRES_URL not set — nothing to do.");
    process.exit(0);
  }

  const client = postgres(process.env.POSTGRES_URL, { max: 1 });

  try {
    await client.begin(async (sql) => {
      const [user] = await sql`
        select id, email from "User" where email = ${TARGET_EMAIL} limit 1
      `;
      if (!user) {
        throw new Error(`No User row for ${TARGET_EMAIL}`);
      }

      const folders = await sql<
        { id: string; name: string; createdAt: Date }[]
      >`
        select id, name, "createdAt" from "Folder"
        where "userId" = ${user.id} and "isSystem" = true
        order by name, "createdAt" asc
      `;

      const groups = new Map<string, { id: string; createdAt: Date }[]>();
      for (const f of folders) {
        const arr = groups.get(f.name) ?? [];
        arr.push(f);
        groups.set(f.name, arr);
      }

      const summary: Record<string, { kept: string; movedImages: number }> = {};

      for (const [name, rows] of groups) {
        if (rows.length <= 1) {
          continue;
        }
        const [keep, ...dupes] = rows; // earliest createdAt, per the ORDER BY
        const dupeIds = dupes.map((d) => d.id);

        // biome-ignore lint/performance/noAwaitInLoops: one-off script — move-then-delete per group must stay sequential
        const moved = await sql`
          update "ImagieImage" set "folderId" = ${keep.id}
          where "folderId" in ${sql(dupeIds)}
        `;
        await sql`delete from "Folder" where id in ${sql(dupeIds)}`;

        summary[name] = { kept: keep.id, movedImages: moved.count };
      }

      if (Object.keys(summary).length === 0) {
        console.log("No duplicate system folders. Nothing to do.");
        return;
      }

      console.log(`Deduped system folders for ${TARGET_EMAIL}:`);
      console.table(summary);
    });
  } catch (error) {
    console.error("Dedup failed — transaction rolled back, DB unchanged:");
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }

  process.exit(0);
}

run();
