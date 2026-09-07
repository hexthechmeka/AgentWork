// Client-side helpers for the RunPod power routes. All actual RunPod REST
// calls happen server-side (the account key never reaches the browser); this
// just wraps our `/api/imagie/runpod/*` endpoints.

const BASE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/imagie`;

export type RunpodStatus = {
  configured: boolean;
  hasRunpodKey: boolean;
  podId?: string | null;
  alive?: boolean;
  generateReady?: boolean;
  desiredStatus?: "RUNNING" | "EXITED" | "TERMINATED" | null;
  ports?: { image: boolean; text: boolean; jupyter: boolean };
};

export type BootPhase =
  | "idle"
  | "starting"
  | "booting"
  | "waiting-backend"
  | "ready";

export async function fetchRunpodStatus(): Promise<RunpodStatus> {
  const res = await fetch(`${BASE}/runpod/status`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`status ${res.status}`);
  }
  return (await res.json()) as RunpodStatus;
}

export async function startRunpod(): Promise<void> {
  const res = await fetch(`${BASE}/runpod/start`, { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `start ${res.status}`);
  }
}

export async function stopRunpod(): Promise<void> {
  const res = await fetch(`${BASE}/runpod/stop`, { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `stop ${res.status}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// TODO(imagie): real cold-start time is unmeasured — 8 min ceiling is a guess.
const READY_TIMEOUT_MS = 8 * 60 * 1000;

/**
 * Ensure the image backend (port 8000) is up and ready to generate. Starts
 * the pod if it's off, then polls until `/api/health` answers. `onPhase`
 * drives the boot animation. Throws on timeout or when power control isn't
 * configured.
 */
export async function ensureGenerateReady(
  onPhase: (phase: BootPhase, elapsedMs: number) => void
): Promise<void> {
  const started = Date.now();
  let status = await fetchRunpodStatus();

  if (!status.configured) {
    throw new Error("Pod ID가 설정되지 않았습니다 (설정 탭)");
  }
  if (status.generateReady) {
    onPhase("ready", 0);
    return;
  }

  if (!status.hasRunpodKey) {
    throw new Error(
      "RunPod API 키가 없어 Pod을 자동으로 켤 수 없습니다. 설정 탭에서 키를 넣거나 수동으로 Pod을 켜세요."
    );
  }

  onPhase("starting", 0);
  await startRunpod();

  while (Date.now() - started < READY_TIMEOUT_MS) {
    // biome-ignore lint/performance/noAwaitInLoops: sequential polling is the point
    await sleep(5000);
    try {
      status = await fetchRunpodStatus();
    } catch {
      // transient — keep polling
    }
    const elapsed = Date.now() - started;
    if (status.generateReady) {
      onPhase("ready", elapsed);
      return;
    }
    onPhase(status.alive ? "waiting-backend" : "booting", elapsed);
  }

  throw new Error(
    "Pod 기동이 예상보다 오래 걸립니다. 잠시 후 다시 시도하세요."
  );
}
