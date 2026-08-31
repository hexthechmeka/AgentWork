import { auth } from "@/app/(auth)/auth";
import { getPersonaById, startPersonaChat } from "@/lib/db/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const persona = await getPersonaById({ id });
  if (!persona || persona.ownerId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const chatId = await startPersonaChat({
    personaRow: persona,
    userId: session.user.id,
  });
  return Response.json({ chatId }, { status: 201 });
}
