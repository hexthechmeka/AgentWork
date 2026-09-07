import "server-only";

import { del, put } from "@vercel/blob";

// Binary media store for generated images. Abstracted so the backend can be
// swapped later (S3, R2, …) without touching the routes. Only VercelBlob is
// implemented today; `getMediaStorage()` picks it via STORAGE_PROVIDER.

export type MediaStorage = {
  /** Upload `data`; returns the public URL. */
  upload: (data: Buffer, key: string, contentType: string) => Promise<string>;
  /** Delete by the URL returned from `upload` (best-effort). */
  delete: (url: string) => Promise<void>;
};

const BLOB_TOKEN = process.env.Agentie_READ_WRITE_TOKEN;

class VercelBlobStorage implements MediaStorage {
  async upload(
    data: Buffer,
    key: string,
    contentType: string
  ): Promise<string> {
    const res = await put(key, data, {
      access: "public",
      addRandomSuffix: false,
      contentType,
      token: BLOB_TOKEN,
    });
    return res.url;
  }

  async delete(url: string): Promise<void> {
    try {
      await del(url, { token: BLOB_TOKEN });
    } catch (error) {
      console.error("[imagie] blob delete failed:", url, error);
    }
  }
}

let cached: MediaStorage | null = null;

export function getMediaStorage(): MediaStorage {
  if (cached) {
    return cached;
  }
  const provider = process.env.STORAGE_PROVIDER ?? "vercel-blob";
  switch (provider) {
    // TODO(imagie): add "s3" / "r2" implementations here.
    default:
      cached = new VercelBlobStorage();
  }
  return cached;
}

// ─── helpers ─────────────────────────────────────────────────────────────

/** `data:image/png;base64,xxxx` or a bare base64 body -> Buffer. */
export function decodeDataUrl(input: string): {
  buffer: Buffer;
  contentType: string;
} {
  const match = input.match(/^data:([^;]+);base64,(.*)$/s);
  if (match) {
    return { buffer: Buffer.from(match[2], "base64"), contentType: match[1] };
  }
  return { buffer: Buffer.from(input, "base64"), contentType: "image/png" };
}

export function imageKey(kind: "orig" | "thumb", id: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const ext = kind === "thumb" ? "thumb.jpg" : "png";
  return `imagie/${yyyy}/${mm}/${id}.${ext}`;
}
