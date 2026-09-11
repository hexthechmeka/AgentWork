import { generateObject } from "ai";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  MissingCredentialError,
  missingCredentialMessage,
} from "@/lib/ai/providers";
import { resolveModelsForUser } from "@/lib/ai/user-models";
import { IMAGICIAN_SYSTEM, imagicianSchema } from "@/lib/imagie/imagician";

// i-magician turn: takes the running chat and returns the next assistant
// message + (when ready) a structured proposal. Reuses the app's existing
// Anthropic provider. TODO(imagie): fold into usage tracking.
const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        content: z.string().max(4000),
        role: z.enum(["user", "assistant"]),
      })
    )
    .min(1)
    .max(30),
});

export async function POST(request: Request) {
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

  try {
    const models = await resolveModelsForUser(session.user.id);
    const { object } = await generateObject({
      messages: body.messages,
      model: models.languageModel("anthropic/claude-haiku-4-5-20251001"),
      schema: imagicianSchema,
      system: IMAGICIAN_SYSTEM,
      temperature: 0.7,
    });
    return Response.json(object);
  } catch (error) {
    if (error instanceof MissingCredentialError) {
      return Response.json(
        { error: missingCredentialMessage(error) },
        { status: 400 }
      );
    }
    console.error("[imagie] imagician failed:", error);
    return Response.json({ error: "생성 도우미 호출 실패" }, { status: 502 });
  }
}
