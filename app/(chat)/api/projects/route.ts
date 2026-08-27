import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  createProject,
  getProjectsWithChatsByUserId,
  getUnclassifiedChatsByUserId,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  let body: z.infer<typeof createProjectSchema>;

  try {
    body = createProjectSchema.parse(await request.json());
  } catch {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const createdProject = await createProject({
    name: body.name,
    userId: session.user.id,
  });

  return Response.json(createdProject, { status: 201 });
}

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const [projects, unclassified] = await Promise.all([
    getProjectsWithChatsByUserId({ userId: session.user.id }),
    getUnclassifiedChatsByUserId({ userId: session.user.id }),
  ]);

  return Response.json({ projects, unclassified });
}
