import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { DEFAULT_PERSONA_PROMPT_TEMPLATE } from "@/lib/ai/prompts";
import { getSetting, setSetting } from "@/lib/db/queries";

const KEY = "persona_prompt_template";
const bodySchema = z.object({ template: z.string().max(20_000) });

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const saved = await getSetting(KEY);
  return Response.json({
    default: DEFAULT_PERSONA_PROMPT_TEMPLATE,
    isDefault: saved === null,
    template: saved ?? DEFAULT_PERSONA_PROMPT_TEMPLATE,
  });
}

export async function PUT(request: Request) {
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
  const trimmed = body.template.trim();
  await setSetting(KEY, trimmed || DEFAULT_PERSONA_PROMPT_TEMPLATE);
  return Response.json({ ok: true });
}
