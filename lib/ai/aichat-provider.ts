// ─── AIchat backend config ────────────────────────────────────────────────
//
// The AIchat feature (persona / roleplay chat) currently runs against an
// OpenAI-compatible endpoint on RunPod. That backend is build-phase only and
// will be swapped for a hosted provider (DeepInfra / OpenRouter / Chutes /
// …) once the feature is done. Everything provider-specific lives here so the
// swap is: change the three env vars (or the model id) and nothing else.
//
//   RUNPOD_AICHAT_BASE_URL   e.g. https://<pod>-8001.proxy.runpod.net/v1
//   RUNPOD_AICHAT_API_KEY    shared key configured on the endpoint
//
// The RunPod endpoint keeps one model resident in VRAM at a time and swaps
// on demand: a request for a different served name unloads the current model
// and loads the requested one. `/v1/models` reports every registered name.
// App-side ids carry the `aichat/` prefix; the served name is the suffix.

import type { ChatModel, ModelCapabilities } from "./models";

export const AICHAT_PROVIDER = "aichat";

export const AICHAT_CONFIG = {
  apiKey: process.env.RUNPOD_AICHAT_API_KEY ?? "",
  baseURL: process.env.RUNPOD_AICHAT_BASE_URL ?? "",
};

/** app-side model id -> served model name (after the `aichat/` prefix). */
export const AICHAT_MODEL_ID = "aichat/roleplay";
export const AICHAT_NT_KO_MODEL_ID = "aichat/nt-ko";

export const AICHAT_MODELS: ChatModel[] = [
  {
    description: "Qwen3.5-9B 기반 롤플레이",
    id: AICHAT_MODEL_ID,
    name: "Roleplay (Qwen)",
    provider: AICHAT_PROVIDER,
  },
  {
    description: "Mistral-Nemo 12B · 한국어 롤플레이 특화 (SFT+DPO)",
    id: AICHAT_NT_KO_MODEL_ID,
    name: "NT-Ko 12B",
    provider: AICHAT_PROVIDER,
  },
];

// Not on the Vercel AI Gateway, so its capability lookup 404s — declare them
// here (same pattern as GLM_KNOWN_CAPABILITIES). Plain chat: no tools /
// vision / reasoning-effort.
export const AICHAT_KNOWN_CAPABILITIES: Record<string, ModelCapabilities> = {
  [AICHAT_MODEL_ID]: { reasoning: false, tools: false, vision: false },
  [AICHAT_NT_KO_MODEL_ID]: { reasoning: false, tools: false, vision: false },
};

export function isAichatModel(modelId: string): boolean {
  return modelId.startsWith(`${AICHAT_PROVIDER}/`);
}
