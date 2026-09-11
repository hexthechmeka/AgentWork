import { config } from "dotenv";
import { eq, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { encryptSecret } from "../crypto/credentials";
import { runpodSetting } from "./schema";

config({ path: ".env.local" });

/**
 * One-off: runpodSetting.apiKey predates lib/crypto/credentials.ts and was
 * stored in plaintext. Encrypts every row that isn't already in the "v1:"
 * form. Safe to run anytime (and repeatedly) — decryptSecret() already
 * treats non-"v1:" values as plaintext, so nothing breaks before this runs;
 * this just closes the at-rest gap.
 *
 * Run once:  pnpm db:encrypt-runpod-keys
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

  const client = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(client);

  try {
    const rows = await db
      .select({ apiKey: runpodSetting.apiKey, userId: runpodSetting.userId })
      .from(runpodSetting)
      .where(isNotNull(runpodSetting.apiKey));

    const plaintext = rows.filter(
      (r) => r.apiKey && !r.apiKey.startsWith("v1:")
    );

    if (plaintext.length === 0) {
      console.log("No plaintext RunPod keys found. Nothing to do.");
      return;
    }

    for (const row of plaintext) {
      // biome-ignore lint/performance/noAwaitInLoops: one-off script, small row count
      await db
        .update(runpodSetting)
        .set({ apiKey: encryptSecret(row.apiKey as string) })
        .where(eq(runpodSetting.userId, row.userId));
    }

    console.log(`Encrypted ${plaintext.length} RunPod key(s).`);
  } finally {
    await client.end();
  }

  process.exit(0);
}

run().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
