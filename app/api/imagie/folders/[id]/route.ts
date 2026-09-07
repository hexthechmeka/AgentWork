import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { deleteFolder, getFolderById, renameFolder } from "@/lib/db/queries";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({ name: z.string().min(1).max(80) });

export async function PATCH(request: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const folder = await getFolderById(id);
  if (!folder) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (folder.isSystem) {
    return Response.json(
      { error: "시스템 폴더는 이름을 바꿀 수 없습니다" },
      { status: 403 }
    );
  }
  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  await renameFolder(id, body.name.trim());
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const folder = await getFolderById(id);
  if (!folder) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (folder.isSystem) {
    return Response.json(
      { error: "시스템 폴더는 삭제할 수 없습니다" },
      { status: 403 }
    );
  }
  await deleteFolder(id);
  return Response.json({ ok: true });
}
