import { config } from "dotenv";
import { and, eq, inArray, like, ne, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { chat, document, suggestion, user } from "./schema";

config({ path: ".env.local" });

const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "owner@agentwork.local";

/**
 * One-off: fold every throwaway `guest-<timestamp>` account's data into the
 * single stable OWNER account, so chat history that got scattered across
 * per-device guest identities shows up again under one login.
 *
 * Run once:  pnpm tsx lib/db/consolidate-guests.ts
 * Idempotent — safe to run again (a second run just finds nothing to move).
 */
async function run() {
  if (!process.env.POSTGRES_URL) {
    console.log("POSTGRES_URL not set — nothing to do.");
    process.exit(0);
  }

  const connection = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(connection);

  // Resolve (or create) the owner account.
  let [owner] = await db
    .select({ email: user.email, id: user.id })
    .from(user)
    .where(eq(user.email, OWNER_EMAIL))
    .limit(1);

  if (owner) {
    console.log(`Owner account: ${owner.email} (${owner.id})`);
  } else {
    [owner] = await db
      .insert(user)
      .values({ email: OWNER_EMAIL, password: null })
      .returning({ email: user.email, id: user.id });
    console.log(`Created owner account ${owner.email} (${owner.id})`);
  }

  const guests = await db
    .select({ email: user.email, id: user.id })
    .from(user)
    .where(and(like(user.email, "guest-%"), ne(user.id, owner.id)));

  if (guests.length === 0) {
    console.log("No guest accounts to consolidate.");
    process.exit(0);
  }

  const guestIds = guests.map((g) => g.id);
  console.log(`Consolidating ${guests.length} guest account(s)…`);

  const movedChats = await db
    .update(chat)
    .set({ userId: owner.id })
    .where(inArray(chat.userId, guestIds))
    .returning({ id: chat.id });

  const movedDocs = await db
    .update(document)
    .set({ userId: owner.id })
    .where(inArray(document.userId, guestIds))
    .returning({ id: document.id });

  const movedSuggestions = await db
    .update(suggestion)
    .set({ userId: owner.id })
    .where(inArray(suggestion.userId, guestIds))
    .returning({ id: suggestion.id });

  // Now that nothing references them, drop the empty guest rows.
  const deletedUsers = await db
    .delete(user)
    .where(inArray(user.id, guestIds))
    .returning({ id: user.id });

  console.log(
    `Moved ${movedChats.length} chats, ${movedDocs.length} documents, ` +
      `${movedSuggestions.length} suggestions.`
  );
  console.log(`Removed ${deletedUsers.length} empty guest accounts.`);

  const [{ count: ownerChats }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(chat)
    .where(eq(chat.userId, owner.id));
  console.log(`Owner now has ${ownerChats} chats total.`);

  process.exit(0);
}

run().catch((err) => {
  console.error("Consolidation failed:");
  console.error(err);
  process.exit(1);
});
