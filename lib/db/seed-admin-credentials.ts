import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { OWNER_EMAIL } from "../constants";
import { encryptSecret } from "../crypto/credentials";
import { user, userCredential } from "./schema";

config({ path: ".env.local" });

/**
 * One-off: BYOK hard cutover. Seeds the admin's UserCredential row from the
 * env keys everyone used to share (ANTHROPIC_API_KEY / GLM_API_KEY), so
 * the admin isn't locked out the moment the shared env keys stop being
 * read by lib/ai/providers.ts. Everyone else must register their own keys
 * in /settings — no fallback.
 *
 * Run once, before removing ANTHROPIC_API_KEY/GLM_API_KEY from Vercel:
 *   pnpm db:seed-admin-credentials
 * Idempotent — re-running overwrites with whatever the env currently holds.
 */
async function run() {
  if (!process.env.POSTGRES_URL) {
    console.log("POSTGRES_URL not set — nothing to do.");
    process.exit(0);
  }
  if (!process.env.CREDENTIALS_ENCRYPTION_KEY) {
    console.error("CREDENTIALS_ENCRYPTION_KEY not set — aborting.");
    process.exit(1);
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const glmApiKey = process.env.GLM_API_KEY;
  if (!(anthropicApiKey || glmApiKey)) {
    console.log(
      "Neither ANTHROPIC_API_KEY nor GLM_API_KEY is set — nothing to seed."
    );
    process.exit(0);
  }

  const client = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(client);

  try {
    const [admin] = await db
      .select({ email: user.email, id: user.id })
      .from(user)
      .where(eq(user.email, OWNER_EMAIL));

    if (!admin) {
      console.error(
        `No User row for ${OWNER_EMAIL} yet — sign in via Firebase first, then re-run.`
      );
      process.exit(1);
    }

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (anthropicApiKey) {
      set.anthropicApiKey = encryptSecret(anthropicApiKey);
    }
    if (glmApiKey) {
      set.glmApiKey = encryptSecret(glmApiKey);
    }

    await db
      .insert(userCredential)
      .values({
        anthropicApiKey: anthropicApiKey
          ? encryptSecret(anthropicApiKey)
          : null,
        glmApiKey: glmApiKey ? encryptSecret(glmApiKey) : null,
        userId: admin.id,
      })
      .onConflictDoUpdate({ set, target: userCredential.userId });

    console.log(
      `Seeded credentials for ${admin.email} (${admin.id}): ` +
        `${anthropicApiKey ? "anthropic " : ""}${glmApiKey ? "glm" : ""}`.trim()
    );
  } finally {
    await client.end();
  }

  process.exit(0);
}

run().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
