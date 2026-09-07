// Resolution presets + sampler list + size validation. Ported from the
// standalone Imagie web app (`web/src/presets.ts`). The backend requires
// width/height in [512, 2048] and divisible by 8 (Stable Diffusion).

export const MIN_SIZE = 512;
export const MAX_SIZE = 2048;

export type SizePreset = {
  id: string;
  label: string;
  width: number;
  height: number;
};

export const DEFAULT_SIZE_PRESETS: SizePreset[] = [
  { height: 512, id: "p512", label: "512×512", width: 512 },
  { height: 768, id: "p768", label: "768×768", width: 768 },
  { height: 768, id: "p1024x768", label: "1024×768", width: 1024 },
  { height: 768, id: "p1376x768", label: "1376×768", width: 1376 },
  { height: 1536, id: "p1024x1536", label: "1024×1536", width: 1024 },
];

/** Returns an error message, or null if `width`/`height` are both valid. */
export function validateSize(width: number, height: number): string | null {
  if (!(Number.isFinite(width) && Number.isFinite(height))) {
    return "숫자를 입력하십시오";
  }
  if (
    width < MIN_SIZE ||
    width > MAX_SIZE ||
    height < MIN_SIZE ||
    height > MAX_SIZE
  ) {
    return `${MIN_SIZE}~${MAX_SIZE} 사이여야 합니다`;
  }
  if (width % 8 !== 0 || height % 8 !== 0) {
    return "8의 배수여야 합니다 (SD 요구사항)";
  }
  return null;
}

// Common Stable Diffusion samplers; the backend maps these to the matching
// diffusers scheduler.
export const SAMPLERS = [
  "Euler a",
  "Euler",
  "DPM++ 2M",
  "DPM++ 2M Karras",
  "DPM++ SDE Karras",
  "DDIM",
  "UniPC",
] as const;

export type Sampler = (typeof SAMPLERS)[number];

export const DEFAULT_SAMPLER: Sampler = "DPM++ 2M Karras";
