import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  DEFAULT_PERSONA_GEN_PARAMS,
  DEFAULT_PERSONA_PROMPT_TEMPLATE,
  parsePersonaGenParams,
} from "@/lib/ai/prompts";
import { getSetting, setSetting } from "@/lib/db/queries";

const TEMPLATE_KEY = "persona_prompt_template";
const GEN_KEY = "persona_gen_params";

const bodySchema = z.object({
  genParams: z.object({
    maxOutputTokens: z.number().int().min(128).max(4000),
    penalty: z.number().min(0).max(2),
    temperature: z.number().min(0).max(2),
    topP: z.number().min(0.05).max(1),
  }),
  template: z.string().max(20_000),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [savedTemplate, savedGen] = await Promise.all([
    getSetting(TEMPLATE_KEY),
    getSetting(GEN_KEY),
  ]);
  return Response.json({
    default: DEFAULT_PERSONA_PROMPT_TEMPLATE,
    defaultGenParams: DEFAULT_PERSONA_GEN_PARAMS,
    genParams: parsePersonaGenParams(savedGen),
    isDefault: savedTemplate === null,
    template: savedTemplate ?? DEFAULT_PERSONA_PROMPT_TEMPLATE,
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
  await Promise.all([
    setSetting(TEMPLATE_KEY, trimmed || DEFAULT_PERSONA_PROMPT_TEMPLATE),
    setSetting(GEN_KEY, JSON.stringify(body.genParams)),
  ]);
  return Response.json({ ok: true });
}
