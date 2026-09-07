// Advanced generation controls (spec §9) — LoRA stack, textual-inversion
// embeddings, IP-Adapter reference, Hires Fix, and img2img. All of these map
// straight onto fields the Imagie backend's GenerateRequest already accepts
// (see lib/imagie/imagie-client.ts). Kept out of beginner mode.

import type { GenerateParams } from "./imagie-client";

export type LoraEntry = { name: string; scale: number };

export type AdvancedSettings = {
  loras: LoraEntry[];
  embeddings: string[];
  // IP-Adapter (character/style consistency)
  refImage: string | null;
  refScale: number;
  // Hires Fix (upscale + second low-strength pass)
  hrEnabled: boolean;
  hrScale: number;
  hrDenoising: number;
  // img2img
  img2imgEnabled: boolean;
  initImage: string | null;
  denoiseStrength: number;
};

export const EMPTY_ADVANCED: AdvancedSettings = {
  denoiseStrength: 0.6,
  embeddings: [],
  hrDenoising: 0.5,
  hrEnabled: false,
  hrScale: 1.5,
  img2imgEnabled: false,
  initImage: null,
  loras: [],
  refImage: null,
  refScale: 0.6,
};

/** Layer the advanced options onto an in-progress GenerateParams. */
export function applyAdvancedToParams(
  params: GenerateParams,
  adv: AdvancedSettings
): GenerateParams {
  const next = { ...params };

  if (adv.loras.length > 0) {
    next.loras = adv.loras.filter((l) => l.name.trim() !== "");
  }
  if (adv.embeddings.length > 0) {
    next.embeddings = adv.embeddings;
  }
  if (adv.refImage) {
    next.ref_image = adv.refImage;
    next.ref_scale = adv.refScale;
  }
  if (adv.hrEnabled) {
    next.hr_enabled = true;
    next.hr_scale = adv.hrScale;
    next.hr_denoising = adv.hrDenoising;
  }
  if (adv.img2imgEnabled && adv.initImage) {
    next.init_image = adv.initImage;
    next.denoise_strength = adv.denoiseStrength;
  }
  return next;
}

/** Which advanced options are carrying non-default data (for the persist metadata). */
export function advancedMetadata(
  adv: AdvancedSettings
): Record<string, unknown> {
  const meta: Record<string, unknown> = {};
  if (adv.loras.length > 0) {
    meta.loras = adv.loras;
  }
  if (adv.embeddings.length > 0) {
    meta.embeddings = adv.embeddings;
  }
  if (adv.refImage) {
    meta.ref_scale = adv.refScale;
    meta.used_ref_image = true;
  }
  if (adv.hrEnabled) {
    meta.hr_denoising = adv.hrDenoising;
    meta.hr_scale = adv.hrScale;
  }
  if (adv.img2imgEnabled && adv.initImage) {
    meta.denoise_strength = adv.denoiseStrength;
    meta.used_init_image = true;
  }
  return meta;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("file read failed"));
    reader.readAsDataURL(file);
  });
}
