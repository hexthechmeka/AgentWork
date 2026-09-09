"use client";

import { useSyncExternalStore } from "react";

// The gallery opens as an overlay on top of the generate screen (not a route
// change) so GenerateView never unmounts and its form state survives. A
// dep-free module singleton shared between the sidebar (trigger) and the
// /imagie page (host).

export type GenPrefill = {
  prompt?: string;
  negativePrompt?: string;
  modelName?: string;
};

type State = {
  open: boolean;
  folderId: string | null;
  prefill: GenPrefill | null;
};

let state: State = { folderId: null, open: false, prefill: null };
const listeners = new Set<() => void>();

function set(next: Partial<State>) {
  state = { ...state, ...next };
  for (const l of listeners) {
    l();
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function openGallery(folderId: string | null = null) {
  set({ folderId, open: true });
}
export function closeGallery() {
  set({ folderId: null, open: false });
}
/** Gallery -> generate: "이 설정으로 다시 생성". */
export function requestPrefill(p: GenPrefill) {
  set({ prefill: p });
  closeGallery();
}
export function consumePrefill(): GenPrefill | null {
  const p = state.prefill;
  if (p) {
    set({ prefill: null });
  }
  return p;
}

export function useGalleryOverlay(): State {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state
  );
}
