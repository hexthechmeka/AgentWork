import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { createFavoritePrompt, listFavoritePrompts } from "@/lib/db/queries";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const favorites = await listFavoritePrompts(session.user.id);
  return Response.json({ favorites });
}

const createSchema = z.object({
  label: z.string().max(120).nullish(),
  negativePrompt: z.string().max(8000).default(""),
  prompt: z.string().min(1).max(12_000),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const favorite = await createFavoritePrompt({
    label: body.label?.trim() || null,
    negativePrompt: body.negativePrompt,
    prompt: body.prompt,
    userId: session.user.id,
  });
  return Response.json({ favorite }, { status: 201 });
}
