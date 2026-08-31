import { AICHAT_KNOWN_CAPABILITIES, AICHAT_MODELS } from "./aichat-provider";

export const DEFAULT_CHAT_MODEL = "anthropic/claude-sonnet-5";

export const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];
export const DEFAULT_EFFORT_LEVEL: EffortLevel = "high";

// GLM-5.3 only accepts low/high/max for reasoning_effort (GLM-5.2 maps
// low/medium -> high and xhigh -> max, so this narrower set is safe for both).
export const GLM_EFFORT_LEVELS = [
  "low",
  "high",
  "max",
] as const satisfies readonly EffortLevel[];
export const DEFAULT_GLM_EFFORT_LEVEL: EffortLevel = "max";

export const titleModel = {
  description: "Fast model for title generation",
  id: "glm/glm-5.3",
  name: "GLM",
  provider: "glm",
};

// When a text-only GLM model is sent a message with an image attached, the
// chat route silently upgrades the call to this vision-capable model for
// that turn (GLM-5.3/5.2 can't accept image input at all).
export const GLM_VISION_MODEL_ID = "glm/glm-5v-turbo";

// Model choices for compressing meeting notes into a formal spec (project
// view's "기획서 작성" step). Scoped to this one feature — not part of the
// main model selector, so these don't need to be in `chatModels` below.
export const SPEC_MODEL_OPTIONS = [
  { id: "anthropic/claude-sonnet-5", name: "Sonnet" },
  { id: "anthropic/claude-opus-5", name: "Opus" },
  { id: "anthropic/claude-fable-5", name: "Fable" },
] as const;
export const DEFAULT_SPEC_MODEL_ID = "anthropic/claude-sonnet-5";

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
};

export const chatModels: ChatModel[] = [
  {
    description: "고성능/고비용",
    id: "anthropic/claude-opus-5",
    name: "Claude Opus",
    provider: "anthropic",
  },
  {
    description: "기획/대화용",
    id: "anthropic/claude-sonnet-5",
    name: "Claude Sonnet",
    provider: "anthropic",
  },
  {
    description: "빠름/저비용",
    id: "anthropic/claude-haiku-4-5-20251001",
    name: "Claude Haiku",
    provider: "anthropic",
  },
  {
    description: "개발/코딩용",
    id: "glm/glm-5.3",
    name: "GLM 5.3",
    provider: "glm",
  },
  {
    description: "개발/코딩용 (이전 버전)",
    id: "glm/glm-5.2",
    name: "GLM 5.2",
    provider: "glm",
  },
  {
    description: "이미지 인식 지원",
    id: GLM_VISION_MODEL_ID,
    name: "GLM Vision",
    provider: "glm",
  },
  ...AICHAT_MODELS,
];

// GLM models aren't registered in the Vercel AI Gateway (we call the GLM
// API directly), so the gateway endpoint lookup below always 404s for them.
// Hardcode their real capabilities instead of silently defaulting to false.
const GLM_KNOWN_CAPABILITIES: Record<string, ModelCapabilities> = {
  "glm/glm-5.2": { reasoning: true, tools: true, vision: true },
  "glm/glm-5.3": { reasoning: true, tools: true, vision: true },
  [GLM_VISION_MODEL_ID]: { reasoning: true, tools: true, vision: true },
};

export async function getCapabilities(): Promise<
  Record<string, ModelCapabilities>
> {
  const results = await Promise.all(
    chatModels.map(async (model) => {
      const known =
        GLM_KNOWN_CAPABILITIES[model.id] ?? AICHAT_KNOWN_CAPABILITIES[model.id];
      if (known) {
        return [model.id, known];
      }

      try {
        const res = await fetch(
          `https://ai-gateway.vercel.sh/v1/models/${model.id}/endpoints`,
          { next: { revalidate: 86_400 } }
        );
        if (!res.ok) {
          return [model.id, { reasoning: false, tools: false, vision: false }];
        }

        const json = await res.json();
        const endpoints = json.data?.endpoints ?? [];
        const params = new Set(
          endpoints.flatMap(
            (e: { supported_parameters?: string[] }) =>
              e.supported_parameters ?? []
          )
        );
        const inputModalities = new Set(
          json.data?.architecture?.input_modalities ?? []
        );

        return [
          model.id,
          {
            reasoning: params.has("reasoning"),
            tools: params.has("tools"),
            vision: inputModalities.has("image"),
          },
        ];
      } catch {
        return [model.id, { reasoning: false, tools: false, vision: false }];
      }
    })
  );

  return Object.fromEntries(results);
}

export const isDemo = process.env.IS_DEMO === "1";

type GatewayModel = {
  id: string;
  name: string;
  type?: string;
  tags?: string[];
};

export type GatewayModelWithCapabilities = ChatModel & {
  capabilities: ModelCapabilities;
};

export async function getAllGatewayModels(): Promise<
  GatewayModelWithCapabilities[]
> {
  try {
    const res = await fetch("https://ai-gateway.vercel.sh/v1/models", {
      next: { revalidate: 86_400 },
    });
    if (!res.ok) {
      return [];
    }

    const json = await res.json();
    return (json.data ?? [])
      .filter((m: GatewayModel) => m.type === "language")
      .map((m: GatewayModel) => ({
        capabilities: {
          reasoning: m.tags?.includes("reasoning") ?? false,
          tools: m.tags?.includes("tool-use") ?? false,
          vision: m.tags?.includes("vision") ?? false,
        },
        description: "",
        id: m.id,
        name: m.name,
        provider: m.id.split("/")[0],
      }));
  } catch {
    return [];
  }
}

export function getActiveModels(): ChatModel[] {
  return chatModels;
}

export const allowedModelIds = new Set(chatModels.map((m) => m.id));

export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>
);

export type ModelAvailability = "healthy" | "impacted" | "unknown";

type GatewayEndpoint = {
  provider_name?: string;
  status?: number;
  uptime_last_15m?: number;
  uptime_last_1h?: number;
  latency_last_1h?: {
    p50?: number;
    p95?: number;
  };
};

const PROVIDER_IMPACTED_UPTIME_THRESHOLD = 99;
const PROVIDER_IMPACTED_P50_MS = 10_000;
const PROVIDER_IMPACTED_P95_MS = 30_000;

function isEndpointImpacted(endpoint: GatewayEndpoint) {
  return (
    (endpoint.status !== undefined && endpoint.status !== 0) ||
    (endpoint.uptime_last_15m !== undefined &&
      endpoint.uptime_last_15m < PROVIDER_IMPACTED_UPTIME_THRESHOLD) ||
    (endpoint.uptime_last_1h !== undefined &&
      endpoint.uptime_last_1h < PROVIDER_IMPACTED_UPTIME_THRESHOLD) ||
    (endpoint.latency_last_1h?.p50 !== undefined &&
      endpoint.latency_last_1h.p50 > PROVIDER_IMPACTED_P50_MS) ||
    (endpoint.latency_last_1h?.p95 !== undefined &&
      endpoint.latency_last_1h.p95 > PROVIDER_IMPACTED_P95_MS)
  );
}

export async function getModelAvailability(
  modelId: string
): Promise<ModelAvailability> {
  const model = chatModels.find((item) => item.id === modelId);

  if (!model) {
    return "unknown";
  }

  try {
    const res = await fetch(
      `https://ai-gateway.vercel.sh/v1/models/${model.id}/endpoints`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) {
      return "unknown";
    }

    const json = await res.json();
    const endpoints = (json.data?.endpoints ?? []) as GatewayEndpoint[];

    if (endpoints.length === 0) {
      return "unknown";
    }

    return endpoints.some(isEndpointImpacted) ? "impacted" : "healthy";
  } catch {
    return "unknown";
  }
}
