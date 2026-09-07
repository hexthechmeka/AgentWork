// Front-side mirror of the Imagie backend model catalog (`backend/config.py`
// `MODELS`) plus per-model recommended sampling settings for beginner mode.
//
// In beginner mode the CFG / steps / sampler are auto-filled from here and
// hidden from the form; the expert panel is the only place they're editable.
//
// v-prediction models (e.g. NoobAI-XL V-pred 1.0) are the exception: the
// backend force-sets Euler + v_prediction + zero-SNR + a low CFG for them
// and the model card says other samplers misbehave — so we must NOT send
// cfg/steps/sampler at all and let the backend own those.

import { DEFAULT_SAMPLER, type Sampler } from "./size-presets";

export type ModelKind = "SD" | "SDXL";

export type Recommended = {
  cfg: number;
  steps: number;
  sampler: Sampler;
};

export type CatalogEntry = {
  name: string;
  kind: ModelKind;
  /** Set for v-pred models — beginner mode leaves sampling to the backend. */
  vPred?: boolean;
  /** "illustrious"/"danbooru" family — lower CFG suits them. */
  danbooruStyle?: boolean;
  recommended?: Recommended;
};

const KARRAS = DEFAULT_SAMPLER; // "DPM++ 2M Karras"

export const MODEL_CATALOG: CatalogEntry[] = [
  { kind: "SD", name: "Stable Diffusion v1.5" },
  {
    kind: "SDXL",
    name: "SDXL 1.0",
    recommended: { cfg: 7.5, sampler: KARRAS, steps: 30 },
  },
  { kind: "SDXL", name: "SDXL Turbo" },
  { danbooruStyle: true, kind: "SDXL", name: "NoobAI-XL 1.1" },
  { kind: "SDXL", name: "NoobAI-XL V-pred 1.0", vPred: true },
  { danbooruStyle: true, kind: "SDXL", name: "Illustrious-XL 1.0" },
  {
    danbooruStyle: true,
    kind: "SDXL",
    name: "WAI-NSFW-illustrious-SDXL v15.0",
    recommended: { cfg: 5, sampler: KARRAS, steps: 30 },
  },
];

const BY_NAME = new Map(MODEL_CATALOG.map((m) => [m.name, m]));

function looksVPred(name: string, prediction?: string): boolean {
  return prediction === "v_prediction" || /v[-_ ]?pred/i.test(name);
}

function looksDanbooru(name: string): boolean {
  return /illustrious|noobai|danbooru|pony|animagine|wai[-_ ]?nsfw/i.test(name);
}

/**
 * Resolve the auto-fill sampling settings for a model.
 *
 * `vPred: true` in the result means the caller must send NO cfg/steps/sampler
 * — the backend owns them.
 */
export function resolveRecommended(
  modelName: string,
  info?: { type?: string; prediction?: string }
): { vPred: true } | ({ vPred: false } & Recommended) {
  const entry = BY_NAME.get(modelName);
  const prediction = info?.prediction;
  const kindHint = (entry?.kind ?? info?.type ?? "").toUpperCase();

  if (entry?.vPred || looksVPred(modelName, prediction)) {
    return { vPred: true };
  }
  if (entry?.recommended) {
    return { vPred: false, ...entry.recommended };
  }

  // Fallback tiers (spec §8).
  const isXL = kindHint.includes("XL");
  const danbooru = entry?.danbooruStyle ?? looksDanbooru(modelName);
  if (!isXL) {
    return { cfg: 7.5, sampler: KARRAS, steps: 30, vPred: false };
  }
  if (danbooru) {
    return { cfg: 5.5, sampler: KARRAS, steps: 25, vPred: false };
  }
  return { cfg: 7, sampler: KARRAS, steps: 25, vPred: false };
}
