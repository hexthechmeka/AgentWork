import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { updateProjectRepoUrl } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

const GITHUB_HTTPS = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+?(?:\.git)?\/?$/;

const patchSchema = z.object({
  // empty string clears the target
  repoUrl: z
    .string()
    .trim()
    .refine((v) => v === "" || GITHUB_HTTPS.test(v), {
      message: "https://github.com/<owner>/<repo> 형식이어야 합니다",
    }),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const { projectId } = await params;

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const updated = await updateProjectRepoUrl({
    id: projectId,
    repoUrl: body.repoUrl === "" ? null : normalizeRepoUrl(body.repoUrl),
    userId: session.user.id,
  });
  if (!updated) {
    return new ChatbotError("not_found:chat").toResponse();
  }
  return Response.json({ repoUrl: updated.repoUrl });
}

function normalizeRepoUrl(v: string): string {
  const trimmed = v.replace(/\/+$/, "");
  return trimmed.endsWith(".git") ? trimmed : `${trimmed}.git`;
}
