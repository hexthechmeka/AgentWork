import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  createPlayerPersona,
  getPlayerPersonasByOwnerId,
} from "@/lib/db/queries";

const createSchema = z.object({
  description: z.string().min(1).max(4000),
  name: z.string().min(1).max(80),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const playerPersonas = await getPlayerPersonasByOwnerId({
    ownerId: session.user.id,
  });
  return Response.json({ playerPersonas });
}

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

  const playerPersona = await createPlayerPersona({
    ...body,
    ownerId: session.user.id,
  });
  return Response.json({ playerPersona }, { status: 201 });
}
