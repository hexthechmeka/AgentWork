import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { resetProviderPeriod } from "@/lib/db/queries";

const bodySchema = z.object({
  provider: z.enum(["anthropic", "glm", "aichat"]),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  await resetProviderPeriod(body);
  return Response.json({ ok: true });
}
