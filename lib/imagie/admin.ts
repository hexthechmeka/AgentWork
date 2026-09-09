// Client helpers for the Imagie backend admin API, routed through our
// server (`/api/imagie/admin/*`) so the admin key stays server-side.

const BASE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/imagie/admin`;

export type HfCatalogEntry = {
  model_id: string;
  type: string;
  prediction?: string | null;
  device?: string;
  dtype?: string;
};
export type HfCatalog = Record<string, HfCatalogEntry>;

async function jsonOrThrow(res: Response) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (body as { error?: string }).error ?? `요청 실패 (${res.status})`
    );
  }
  return body;
}

export async function fetchHfCatalog(): Promise<HfCatalog> {
  const body = await jsonOrThrow(await fetch(`${BASE}/catalog`));
  return (body as { catalog: HfCatalog }).catalog;
}

export function addHfModel(input: {
  name: string;
  model_id: string;
  type: "SD" | "SDXL" | "FLUX";
  prediction: "v_prediction" | null;
  verify: boolean;
}): Promise<unknown> {
  return fetch(`${BASE}/catalog`, {
    body: JSON.stringify(input),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  }).then(jsonOrThrow);
}

export function deleteHfModel(name: string): Promise<unknown> {
  return fetch(`${BASE}/catalog/${encodeURIComponent(name)}`, {
    method: "DELETE",
  }).then(jsonOrThrow);
}

export function deleteImagieFile(
  kind: "loras" | "embeddings",
  name: string
): Promise<unknown> {
  return fetch(`${BASE}/files/${kind}/${encodeURIComponent(name)}`, {
    method: "DELETE",
  }).then(jsonOrThrow);
}

export function addFromUrl(input: {
  kind: "checkpoints" | "loras" | "embeddings";
  url: string;
  filename: string;
}): Promise<unknown> {
  return fetch(`${BASE}/from-url`, {
    body: JSON.stringify(input),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  }).then(jsonOrThrow);
}
