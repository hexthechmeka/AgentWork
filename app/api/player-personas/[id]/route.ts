import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  deletePlayerPersona,
  getPlayerPersonaById,
  updatePlayerPersona,
} from "@/lib/db/queries";

const patchSchema = z.object({
  description: z.string().min(1).max(4000).optional(),
  name: z.string().min(1).max(80).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

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

  const playerPersona = await updatePlayerPersona({
    id,
    ownerId: session.user.id,
    ...body,
  });
  if (!playerPersona) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ playerPersona });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await getPlayerPersonaById({ id });
  if (!existing || existing.ownerId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  await deletePlayerPersona({ id, ownerId: session.user.id });
  return Response.json({ ok: true });
}
