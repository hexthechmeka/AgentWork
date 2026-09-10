import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

/**
 * One-off migration for the NextAuth -> Firebase Auth cutover.
 *
 * Before Firebase sign-in, this app's data is split across three kinds of
 * legacy identity:
 *   - `owner@agentwork.local`  — the account every cookieless visit was
 *     auto-logged into (holds the bulk of chats/projects/images).
 *   - `guest-<timestamp>` rows — the even older per-visit guest scheme.
 *   - the real admin's own `User` row (TARGET_EMAIL) — created by a handful
 *     of earlier real email logins.
 *
 * Firebase Google sign-in resolves to an existing `User` row *by email*
 * (see upsertFirebaseUser in lib/db/queries.ts), so without this the admin
 * would sign in to their own small row and the `owner@agentwork.local`
 * bucket would be orphaned. This repoints every user-scoped row from the
 * legacy identities onto TARGET_EMAIL, then deletes the emptied rows.
 *
 * Run once, BEFORE the first Firebase sign-in:
 *   pnpm tsx lib/db/consolidate-to-admin.ts
 *
 * Idempotent: a second run finds no legacy rows and no-ops. Everything
 * happens in a single transaction — on any error nothing is changed.
 */

const TARGET_EMAIL =
  process.env.CONSOLIDATE_TARGET_EMAIL ?? "hexthechmeka@gmail.com";

// RunpodSetting has userId as its PRIMARY KEY (one row per account), so it
// can't be repointed with a blind UPDATE — handled separately below.
const RUNPOD_TABLE = "RunpodSetting";

async function run() {
  if (!process.env.POSTGRES_URL) {
    console.log("POSTGRES_URL not set — nothing to do.");
    process.exit(0);
  }

  const client = postgres(process.env.POSTGRES_URL, { max: 1 });

  try {
    await client.begin(async (sql) => {
      const [target] = await sql`
        select id, email from "User" where email = ${TARGET_EMAIL} limit 1
      `;

      if (!target) {
        throw new Error(
          `Target account ${TARGET_EMAIL} has no User row yet. Sign in once via Firebase to create it, then re-run — or set CONSOLIDATE_TARGET_EMAIL.`
        );
      }

      const sources = await sql`
        select id, email from "User"
        where (email = 'owner@agentwork.local' or email like 'guest-%')
          and id <> ${target.id}
      `;

      if (sources.length === 0) {
        console.log(
          "No legacy owner/guest rows to consolidate. Nothing to do."
        );
        return;
      }

      const sourceIds = sources.map((s) => s.id as string);
      console.log(
        `Target: ${target.email} (${target.id})\n` +
          `Merging ${sources.length} legacy row(s): ` +
          `${sources.filter((s) => s.email === "owner@agentwork.local").length} owner, ` +
          `${sources.filter((s) => String(s.email).startsWith("guest-")).length} guest\n`
      );

      // Discover every FK column that references "User"(id), so tables added
      // by later work are covered without editing this script.
      const fkColumns = await sql<
        { table_name: string; column_name: string }[]
      >`
        select tc.table_name, kcu.column_name
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on tc.constraint_name = kcu.constraint_name
         and tc.table_schema = kcu.table_schema
        join information_schema.constraint_column_usage ccu
          on tc.constraint_name = ccu.constraint_name
         and tc.table_schema = ccu.table_schema
        where tc.constraint_type = 'FOREIGN KEY'
          and tc.table_schema = 'public'
          and ccu.table_name = 'User'
          and ccu.column_name = 'id'
        order by tc.table_name, kcu.column_name
      `;

      const summary: Record<string, number> = {};

      // Each UPDATE is independent ("set <fk> = target where <fk> in
      // sources"), and postgres.js serializes them on the transaction's
      // single connection anyway.
      const moves = fkColumns
        .filter(({ table_name }) => table_name !== RUNPOD_TABLE)
        .map(async ({ table_name, column_name }) => {
          const moved = await sql`
            update ${sql(table_name)}
            set ${sql(column_name)} = ${target.id}
            where ${sql(column_name)} in ${sql(sourceIds)}
          `;
          return { count: moved.count, key: `${table_name}.${column_name}` };
        });

      for (const { key, count } of await Promise.all(moves)) {
        if (count > 0) {
          summary[key] = count;
        }
      }

      // RunpodSetting: keep the target's row if it already has one, else
      // promote the most-recently-updated legacy row; drop the rest.
      const [targetRunpod] = await sql`
        select 1 from ${sql(RUNPOD_TABLE)} where "userId" = ${target.id} limit 1
      `;
      if (targetRunpod) {
        const dropped = await sql`
          delete from ${sql(RUNPOD_TABLE)} where "userId" in ${sql(sourceIds)}
        `;
        if (dropped.count > 0) {
          summary[`${RUNPOD_TABLE} (dropped, target already had one)`] =
            dropped.count;
        }
      } else {
        const [keep] = await sql`
          select "userId" from ${sql(RUNPOD_TABLE)}
          where "userId" in ${sql(sourceIds)}
          order by "updatedAt" desc
          limit 1
        `;
        if (keep) {
          await sql`
            delete from ${sql(RUNPOD_TABLE)}
            where "userId" in ${sql(sourceIds)} and "userId" <> ${keep.userId}
          `;
          const promoted = await sql`
            update ${sql(RUNPOD_TABLE)}
            set "userId" = ${target.id}
            where "userId" = ${keep.userId}
          `;
          if (promoted.count > 0) {
            summary[`${RUNPOD_TABLE} (promoted)`] = promoted.count;
          }
        }
      }

      // Everything is repointed — the legacy rows are now unreferenced.
      const deleted = await sql`
        delete from "User" where id in ${sql(sourceIds)}
      `;
      summary["User (deleted legacy rows)"] = deleted.count;

      console.log("Done:");
      console.table(summary);

      const [{ chats }] = await sql`
        select count(*)::int as chats from "Chat" where "userId" = ${target.id}
      `;
      const [{ images }] = await sql`
        select count(*)::int as images from "ImagieImage" where "userId" = ${target.id}
      `;
      const [{ projects }] = await sql`
        select count(*)::int as projects from "Project" where "userId" = ${target.id}
      `;
      console.log(
        `\n${TARGET_EMAIL} now owns: ${chats} chats, ${projects} projects, ${images} images.`
      );
    });
  } catch (error) {
    console.error(
      "\nConsolidation failed — transaction rolled back, DB unchanged:"
    );
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }

  process.exit(0);
}

run();
