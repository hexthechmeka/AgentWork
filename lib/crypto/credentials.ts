import "server-only";

// Encrypts user-supplied secrets (LLM API keys, GitHub PAT, RunPod key)
// before they touch the database. See ./credentials-core.ts for the actual
// AES-256-GCM logic — this file just adds the server-only guard for app
// code (route handlers, server actions, lib/db/queries.ts).
export { decryptSecret, encryptSecret } from "./credentials-core";
