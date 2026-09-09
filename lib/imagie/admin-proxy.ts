import "server-only";

import { getRunpodSetting } from "@/lib/db/queries";
import { POD_PORTS, podProxyUrl } from "@/lib/imagie/runpod";

// Server-side proxy to the Imagie backend's /api/admin/* endpoints. The
// backend admin key (IMAGIE_ADMIN_KEY) is a Vercel env var and never reaches
// the browser — same principle as RUNPOD control. The target pod is the
// caller's own (RunpodSetting.podId).

export class AdminProxyError extends Error {
  status: number;
  constructor(message: string, status: number, options?: ErrorOptions) {
    super(message, options);
    this.status = status;
  }
}

async function resolveBase(userId: string): Promise<string> {
  const key = process.env.IMAGIE_ADMIN_KEY;
  if (!key) {
    throw new AdminProxyError("IMAGIE_ADMIN_KEY가 설정되지 않았습니다", 503);
  }
  const row = await getRunpodSetting(userId);
  if (!row?.podId) {
    throw new AdminProxyError("Pod ID를 먼저 설정하세요", 400);
  }
  return podProxyUrl(row.podId, POD_PORTS.image);
}

/**
 * Forward a request to `${pod}/api/admin${path}` with the admin bearer.
 * Returns the parsed JSON body; throws AdminProxyError with the upstream
 * status on failure.
 */
export async function adminFetch<T = unknown>(
  userId: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const base = await resolveBase(userId);
  let res: Response;
  try {
    res = await fetch(`${base}/api/admin${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${process.env.IMAGIE_ADMIN_KEY}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      signal: AbortSignal.timeout(init.method === "GET" ? 15_000 : 120_000),
    });
  } catch (e) {
    // biome-ignore lint/style/useErrorCause: cause is the 3rd arg (custom Error subclass)
    throw new AdminProxyError(
      e instanceof Error ? e.message : "pod에 연결하지 못했습니다",
      502,
      { cause: e }
    );
  }
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new AdminProxyError(
      (body as { detail?: string }).detail ?? `admin ${res.status}`,
      res.status
    );
  }
  return body as T;
}
