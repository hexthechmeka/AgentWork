import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  createPersona,
  getPersonaChatsByOwnerId,
  getPersonasByOwnerId,
} from "@/lib/db/queries";

const createSchema = z.object({
  avatarUrl: z.string().url().nullish(),
  defaultModel: z.string().min(1),
  name: z.string().min(1).max(120),
  openingMessage: z.string().max(8000).nullish(),
  panelImageUrl: z.string().url().nullish(),
  personality: z.string().min(1).max(20_000),
  scenario: z.string().max(8000).nullish(),
  tagline: z.string().max(300).nullish(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  userPersona: z.string().max(4000).nullish(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [personas, chats] = await Promise.all([
    getPersonasByOwnerId({ ownerId: session.user.id }),
    getPersonaChatsByOwnerId({ userId: session.user.id }),
  ]);
  return Response.json({ chats, personas });
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

  const persona = await createPersona({ ...body, ownerId: session.user.id });
  return Response.json({ persona }, { status: 201 });
}
