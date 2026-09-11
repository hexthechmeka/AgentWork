import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Encrypts user-supplied secrets (LLM API keys, GitHub PAT, RunPod key)
// before they touch the database. AES-256-GCM with a per-value random IV.
// Packed format: "v1:<base64 iv>.<base64 authTag>.<base64 ciphertext>".
//
// decryptSecret() treats anything without the "v1:" prefix as already
// plaintext and returns it unchanged — this lets existing plaintext rows
// (runpodSetting.apiKey, written before this module existed) keep working
// until a migration script re-encrypts them; encryptSecret() always
// produces the v1: form, so new writes are never plaintext.

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const PREFIX = "v1:";

function getKey(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY is not set — cannot encrypt/decrypt credentials"
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `CREDENTIALS_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}) — generate with: openssl rand -base64 32`
    );
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}.${authTag.toString("base64")}.${ciphertext.toString("base64")}`;
}

export function decryptSecret(packed: string): string {
  if (!packed.startsWith(PREFIX)) {
    return packed;
  }
  const [ivB64, tagB64, ctB64] = packed.slice(PREFIX.length).split(".");
  if (!(ivB64 && tagB64 && ctB64)) {
    throw new Error("Malformed encrypted credential value");
  }
  const decipher = createDecipheriv(
    ALGO,
    getKey(),
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
