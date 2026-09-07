// Browser-side client for the Imagie backend (RunPod FastAPI). Ported from
// the standalone Imagie web app (`web/src/api/client.ts`) — the backend is
// never modified, so this is the authoritative request/response contract.
//
// These calls go straight to the pod (its CORS is `allow_origins=["*"]`) so
// long generations and progress polling never touch our Vercel functions.
// The base URL is `https://{podId}-8000.proxy.runpod.net`, fetched once from
// `GET /api/imagie/config`.

const REQUEST_TIMEOUT_MS = 5 * 60 * 1000; // 5 min — first real model load is slow

export type ImagieModelInfo = {
  name: string;
  type: string;
  cached: boolean;
  prediction?: string;
};

export type ModelListResponse = {
  models: string[];
  loaded_model: string | null;
  detail?: ImagieModelInfo[];
};

export type LoraListResponse = { loras: string[] };
export type EmbeddingListResponse = { embeddings: string[] };

export type GenerateParams = {
  prompt: string;
  negative_prompt?: string;
  model_name: string;
  width: number;
  height: number;
  /** Omitted for v-pred models — the backend forces its own sampling. */
  steps?: number;
  guidance_scale?: number;
  sampler?: string;
  /** Omit for a fresh random seed per image; the server reports what it used. */
  seed?: number;
  batch_size?: number;
  loras?: Array<{ name: string; scale: number }>;
  embeddings?: string[];
  init_image?: string | null;
  denoise_strength?: number;
  ref_image?: string | null;
  ref_scale?: number;
  hr_enabled?: boolean;
  hr_scale?: number;
  hr_denoising?: number;
  /** experimental — routed through the expert panel only. */
  safety_check?: boolean;
};

export type GenerateResponse = {
  /** base64 PNG per image, in generation order. */
  images: string[];
  /** Seed actually used for each image, same order as `images`. */
  seeds: number[];
  metadata: Record<string, unknown>;
  /** True when a cancel cut the batch short; `images` holds what finished. */
  cancelled: boolean;
};

export type ProgressPhase = "idle" | "loading" | "warmup" | "generating";

export type ProgressResponse = {
  phase: ProgressPhase;
  active: boolean;
  step: number;
  total: number;
  percent: number;
  batch_index: number;
  batch_total: number;
  preview_version: number;
  cancelling: boolean;
};

export type PreviewResponse = {
  /** Downscaled JPEG of the last finished image, or null before the first. */
  image: string | null;
  version: number;
};

function trimBase(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

async function request<T>(
  baseUrl: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${trimBase(baseUrl)}${path}`, {
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      ...options,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Imagie ${response.status}: ${text || response.statusText}`
      );
    }
    return (await response.json()) as T;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error(
        `요청이 ${REQUEST_TIMEOUT_MS / 1000}초 후 시간 초과되었습니다`,
        { cause: e }
      );
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function getModels(baseUrl: string): Promise<ModelListResponse> {
  return request<ModelListResponse>(baseUrl, "/api/models");
}

export function getLoras(baseUrl: string): Promise<LoraListResponse> {
  return request<LoraListResponse>(baseUrl, "/api/loras");
}

export function getEmbeddings(baseUrl: string): Promise<EmbeddingListResponse> {
  return request<EmbeddingListResponse>(baseUrl, "/api/embeddings");
}

export function loadModel(
  baseUrl: string,
  modelName: string
): Promise<unknown> {
  return request(baseUrl, "/api/load_model", {
    body: JSON.stringify({ model_name: modelName }),
    method: "POST",
  });
}

export function getProgress(baseUrl: string): Promise<ProgressResponse> {
  return request<ProgressResponse>(baseUrl, "/api/progress");
}

export function getPreview(baseUrl: string): Promise<PreviewResponse> {
  return request<PreviewResponse>(baseUrl, "/api/preview");
}

export function cancelGeneration(baseUrl: string): Promise<unknown> {
  return request(baseUrl, "/api/cancel", { method: "POST" });
}

export function generateImage(
  baseUrl: string,
  params: GenerateParams
): Promise<GenerateResponse> {
  return request<GenerateResponse>(baseUrl, "/api/generate", {
    body: JSON.stringify(params),
    method: "POST",
  });
}

/** Quick liveness probe against the image API (port 8000). */
export async function pingHealth(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${trimBase(baseUrl)}/api/health`, {
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
