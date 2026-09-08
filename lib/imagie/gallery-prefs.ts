// Per-browser gallery view preferences (localStorage).

const KEYS = {
  incognito: "imagie.gallery.incognito",
  sort: "imagie.gallery.sort",
} as const;

export type GallerySort = "new" | "old" | "model";

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
    // best-effort
  }
}

export function getIncognito(): boolean {
  return read(KEYS.incognito) === "1";
}

export function setIncognito(on: boolean): void {
  write(KEYS.incognito, on ? "1" : "0");
}

export function getGallerySort(): GallerySort {
  const v = read(KEYS.sort);
  return v === "old" || v === "model" ? v : "new";
}

export function setGallerySort(v: GallerySort): void {
  write(KEYS.sort, v);
}
