import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { getChatById, setChatPlayerPersona } from "@/lib/db/queries";

const patchSchema = z.object({
  playerPersonaId: z.string().uuid().nullable(),
});

type Ctx = { params: Promise<{ chatId: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { chatId } = await params;

  const chat = await getChatById({ id: chatId });
  if (!chat || chat.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  await setChatPlayerPersona({
    chatId,
    playerPersonaId: body.playerPersonaId,
    userId: session.user.id,
  });
  return Response.json({ ok: true });
}
