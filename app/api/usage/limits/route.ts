import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { setProviderLimit } from "@/lib/db/queries";

const bodySchema = z.object({
  hardLimitUsd: z.number().nonnegative().nullable(),
  provider: z.enum(["anthropic", "glm"]),
  softLimitUsd: z.number().nonnegative().nullable(),
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

  await setProviderLimit(body);
  return Response.json({ ok: true });
}
