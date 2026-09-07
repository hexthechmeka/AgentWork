import "server-only";

// Direct calls to RunPod's own REST API — separate from imagie-client.ts,
// which talks to our backend *inside* the pod. This one manages the pod
// itself (start/stop/status) so it must work when the pod is off. Ported
// from the standalone Imagie app (`web/src/api/runpod.ts`), but here it runs
// server-side only: the account API key never reaches the browser.

const RUNPOD_API_BASE = "https://rest.runpod.io/v1";

export type PodDesiredStatus = "RUNNING" | "EXITED" | "TERMINATED";

export type PodStatus = {
  id: string;
  desiredStatus: PodDesiredStatus;
  lastStatusChange?: string;
};

/**
 * Pull the pod id out of a proxy URL, e.g.
 * "https://17zbqen0ahx0p0-8000.proxy.runpod.net" -> "17zbqen0ahx0p0".
 * A bare id is returned unchanged. Returns null for anything that is
 * neither.
 */
export function derivePodId(input: string): string | null {
  const raw = input.trim();
  if (!raw) {
    return null;
  }
  // Bare id (no dot, no slash, no scheme).
  if (/^[a-z0-9]+$/i.test(raw)) {
    return raw;
  }
  try {
    const host = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname;
    if (!host.endsWith(".proxy.runpod.net")) {
      return null;
    }
    return host.split(".")[0].split("-")[0] || null;
  } catch {
    return null;
  }
}

async function runpodRequest<T>(
  path: string,
  apiKey: string,
  method: "GET" | "POST" = "GET"
): Promise<T> {
  const res = await fetch(`${RUNPOD_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    method,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`RunPod API ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export function getPodStatus(
  podId: string,
  apiKey: string
): Promise<PodStatus> {
  return runpodRequest<PodStatus>(`/pods/${podId}`, apiKey);
}

export function startPod(podId: string, apiKey: string): Promise<PodStatus> {
  return runpodRequest<PodStatus>(`/pods/${podId}/start`, apiKey, "POST");
}

export function stopPod(podId: string, apiKey: string): Promise<PodStatus> {
  return runpodRequest<PodStatus>(`/pods/${podId}/stop`, apiKey, "POST");
}

// Ports the pod exposes, by role — used for the health checks in
// /api/imagie/runpod/status.
export const POD_PORTS = { image: 8000, jupyter: 8888, text: 8001 } as const;

export function podProxyUrl(podId: string, port: number): string {
  return `https://${podId}-${port}.proxy.runpod.net`;
}

/** HTTP-reachable? (any status, even 4xx, counts as "the port answered"). */
export async function portResponds(
  podId: string,
  port: number
): Promise<boolean> {
  try {
    const res = await fetch(podProxyUrl(podId, port), {
      method: "GET",
      signal: AbortSignal.timeout(4000),
    });
    return res.status > 0;
  } catch {
    return false;
  }
}

/** The image API specifically is up and ready to generate. */
export async function imageApiReady(podId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${podProxyUrl(podId, POD_PORTS.image)}/api/health`,
      {
        signal: AbortSignal.timeout(4000),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}
