import "server-only";

// Vercel <-> Vultr dev-agent bridge. Heavy code execution + GLM calls run on
// the Vultr server; Vercel only forwards the trigger and proxies the SSE
// progress stream. Auth both directions is a shared secret.

const SECRET = process.env.VULTR_AGENT_SECRET ?? "";

/**
 * Inbound (Vultr -> Vercel): returns a 401 Response when the bearer doesn't
 * match, or null when it's fine.
 */
export function vultrSecretError(request: Request): Response | null {
  if (!SECRET || request.headers.get("authorization") !== `Bearer ${SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export class VultrUnconfiguredError extends Error {}

/** Outbound (Vercel -> Vultr): fetch with the bearer attached. */
export function vultrFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const base = process.env.VULTR_AGENT_URL;
  if (!base) {
    throw new VultrUnconfiguredError("VULTR_AGENT_URL이 설정되지 않았습니다");
  }
  return fetch(`${base.replace(/\/+$/, "")}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${SECRET}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
}
