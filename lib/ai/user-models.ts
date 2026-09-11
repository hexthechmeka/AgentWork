import "server-only";

import { getUserCredentials } from "@/lib/db/queries";
import { resolveUserModels, type UserModels } from "./providers";

/** Fetches + decrypts the given user's BYOK credentials and returns model
 * accessors bound to them. See resolveUserModels() for the throw contract. */
export async function resolveModelsForUser(
  userId: string
): Promise<UserModels> {
  const creds = await getUserCredentials(userId);
  return resolveUserModels({
    anthropicApiKey: creds?.anthropicApiKey,
    glmApiKey: creds?.glmApiKey,
  });
}
