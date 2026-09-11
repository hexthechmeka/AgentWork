import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  getRunpodSetting,
  getUserCredentialStatus,
  upsertRunpodSetting,
  upsertUserCredential,
} from "@/lib/db/queries";

async function statusFor(userId: string) {
  const [credStatus, runpod] = await Promise.all([
    getUserCredentialStatus(userId),
    getRunpodSetting(userId),
  ]);
  return {
    hasAnthropic: credStatus.hasAnthropic,
    hasGithubPat: credStatus.hasGithubPat,
    hasGlm: credStatus.hasGlm,
    hasRunpodKey: Boolean(runpod?.apiKey),
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(await statusFor(session.user.id));
}

// Empty string clears a key; omit a field to leave it unchanged. Values are
// never echoed back — GET/PUT both return booleans only.
const bodySchema = z.object({
  anthropicApiKey: z.string().max(400).optional(),
  githubPat: z.string().max(400).optional(),
  glmApiKey: z.string().max(400).optional(),
  runpodApiKey: z.string().max(400).optional(),
});

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const normalize = (v: string | undefined) =>
    v === undefined ? undefined : v.trim() === "" ? null : v.trim();

  const anthropicApiKey = normalize(body.anthropicApiKey);
  const githubPat = normalize(body.githubPat);
  const glmApiKey = normalize(body.glmApiKey);
  const runpodApiKey = normalize(body.runpodApiKey);

  await Promise.all([
    anthropicApiKey !== undefined ||
    githubPat !== undefined ||
    glmApiKey !== undefined
      ? upsertUserCredential(session.user.id, {
          anthropicApiKey,
          githubPat,
          glmApiKey,
        })
      : Promise.resolve(),
    runpodApiKey === undefined
      ? Promise.resolve()
      : upsertRunpodSetting(session.user.id, { apiKey: runpodApiKey }),
  ]);

  return Response.json(await statusFor(session.user.id));
}
