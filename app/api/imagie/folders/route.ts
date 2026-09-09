import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  createFolder,
  ensureSystemFolders,
  listFolders,
} from "@/lib/db/queries";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureSystemFolders(session.user.id);
  const folders = await listFolders(session.user.id);
  return Response.json({ folders });
}

const createSchema = z.object({ name: z.string().min(1).max(80) });

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
  const folder = await createFolder(session.user.id, body.name.trim());
  return Response.json({ folder }, { status: 201 });
}
