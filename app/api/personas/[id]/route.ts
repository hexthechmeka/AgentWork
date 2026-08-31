import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { deletePersona, getPersonaById, updatePersona } from "@/lib/db/queries";

const patchSchema = z.object({
  avatarUrl: z.string().url().nullish(),
  defaultModel: z.string().min(1).optional(),
  name: z.string().min(1).max(120).optional(),
  openingMessage: z.string().max(8000).nullish(),
  panelImageUrl: z.string().url().nullish(),
  personality: z.string().min(1).max(20_000).optional(),
  scenario: z.string().max(8000).nullish(),
  tagline: z.string().max(300).nullish(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  userPersona: z.string().max(4000).nullish(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const persona = await getPersonaById({ id });
  if (!persona || persona.ownerId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ persona });
}

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

  const persona = await updatePersona({
    id,
    ownerId: session.user.id,
    ...body,
  });
  if (!persona) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ persona });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await deletePersona({ id, ownerId: session.user.id });
  return Response.json({ ok: true });
}
