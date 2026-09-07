import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { deleteFavoritePrompt, updateFavoritePrompt } from "@/lib/db/queries";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  label: z.string().max(120).nullish(),
  negativePrompt: z.string().max(8000).optional(),
  prompt: z.string().min(1).max(12_000).optional(),
});

export async function PATCH(request: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  await updateFavoritePrompt(id, {
    ...(body.label === undefined ? {} : { label: body.label?.trim() || null }),
    ...(body.prompt === undefined ? {} : { prompt: body.prompt }),
    ...(body.negativePrompt === undefined
      ? {}
      : { negativePrompt: body.negativePrompt }),
  });
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await deleteFavoritePrompt(id);
  return Response.json({ ok: true });
}
