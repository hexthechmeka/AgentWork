// Per-browser Imagie preferences (localStorage). Mirrors the standalone
// Imagie app's `settings.ts` — size presets, default model and expert-mode
// toggle live here, not the DB, since they're device-local conveniences.

import { DEFAULT_SIZE_PRESETS, type SizePreset } from "./size-presets";

const KEYS = {
  defaultModel: "imagie.defaultModel",
  expertMode: "imagie.expertMode",
  formCollapsed: "imagie.formCollapsed",
  imagician: "imagie.imagician",
  navOpen: "imagie.navOpen",
  negative: "imagie.defaultNegative",
  sizePresets: "imagie.sizePresets",
} as const;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Best-effort: private browsing / quota shouldn't break the session.
  }
}

export function getExpertMode(): boolean {
  return read(KEYS.expertMode) === "1";
}

export function setExpertMode(on: boolean): void {
  write(KEYS.expertMode, on ? "1" : "0");
}

export function getImagician(): boolean {
  return read(KEYS.imagician) === "1";
}

export function setImagician(on: boolean): void {
  write(KEYS.imagician, on ? "1" : "0");
}

export function getDefaultModel(): string {
  return read(KEYS.defaultModel) ?? "";
}

export function setDefaultModel(name: string): void {
  write(KEYS.defaultModel, name);
}

export function getSizePresets(): SizePreset[] {
  try {
    const raw = read(KEYS.sizePresets);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as SizePreset[];
    }
  } catch {
    // fall through
  }
  return [...DEFAULT_SIZE_PRESETS];
}

export function setSizePresets(presets: SizePreset[]): void {
  write(KEYS.sizePresets, JSON.stringify(presets));
}

export function getStoredNegative(fallback: string): string {
  return read(KEYS.negative) ?? fallback;
}

export function setStoredNegative(value: string): void {
  write(KEYS.negative, value);
}

// /imagie left-nav sidebar — its own key so it doesn't leak into the chat
// sidebar's `sidebar_state` cookie. Default collapsed.
export function getNavOpen(): boolean {
  return read(KEYS.navOpen) === "1";
}

export function setNavOpen(open: boolean): void {
  write(KEYS.navOpen, open ? "1" : "0");
}

// Generate screen's 440px input panel. Default expanded.
export function getFormCollapsed(): boolean {
  return read(KEYS.formCollapsed) === "1";
}

export function setFormCollapsed(collapsed: boolean): void {
  write(KEYS.formCollapsed, collapsed ? "1" : "0");
}
