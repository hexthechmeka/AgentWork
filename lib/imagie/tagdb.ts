// Danbooru tag autocomplete. The CSV (~3.5MB, 140k tags) is served from
// /public and fetched lazily on the first keystroke, then cached in-module
// for the session. Ported from the standalone Imagie web app
// (`web/src/lib/tagdb.ts`).
//
// CSV columns: tag,category,post_count,"alias1,alias2"

const ASSET_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/imagie/danbooru_tags.csv`;

export type TagEntry = {
  /** Underscored form, as written in the CSV — what we match against. */
  tag: string;
  /** Spaced form, what gets inserted into the prompt. */
  display: string;
  count: number;
  /** Lowercased, comma-joined aliases. */
  aliases: string;
};

let db: TagEntry[] | null = null;
let loading: Promise<TagEntry[] | null> | null = null;

function parse(text: string): TagEntry[] {
  const out: TagEntry[] = [];
  for (const line of text.split("\n")) {
    const c1 = line.indexOf(",");
    if (c1 < 1) {
      continue;
    }
    const c2 = line.indexOf(",", c1 + 1);
    if (c2 < 0) {
      continue;
    }
    const c3 = line.indexOf(",", c2 + 1);
    const tag = line.slice(0, c1);
    const count =
      Number.parseInt(
        c3 > 0 ? line.slice(c2 + 1, c3) : line.slice(c2 + 1),
        10
      ) || 0;
    const aliases =
      c3 > 0
        ? line
            .slice(c3 + 1)
            .replace(/"/g, "")
            .toLowerCase()
        : "";
    out.push({ aliases, count, display: tag.replace(/_/g, " "), tag });
  }
  // Most-used first, so a prefix scan can stop early and still return the
  // tags people actually mean.
  out.sort((a, b) => b.count - a.count);
  return out;
}

export function loadTagDb(): Promise<TagEntry[] | null> {
  if (db) {
    return Promise.resolve(db);
  }
  if (loading) {
    return loading;
  }
  loading = fetch(ASSET_URL)
    .then((r) => (r.ok ? r.text() : null))
    .then((text) => {
      db = text ? parse(text) : null;
      return db;
    })
    .catch(() => null)
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** Exact-prefix hits first, then substring / alias hits. */
export function searchTags(
  entries: TagEntry[],
  query: string,
  limit = 12
): TagEntry[] {
  const q = query.toLowerCase().trim().replace(/ /g, "_");
  if (!q) {
    return [];
  }
  const prefix: TagEntry[] = [];
  const substr: TagEntry[] = [];
  for (const entry of entries) {
    if (entry.tag.startsWith(q)) {
      prefix.push(entry);
      if (prefix.length >= limit) {
        break;
      }
    } else if (
      substr.length < limit &&
      (entry.tag.includes(q) || entry.aliases.includes(q))
    ) {
      substr.push(entry);
    }
  }
  return [...prefix, ...substr].slice(0, limit);
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1000) {
    return `${Math.round(n / 1000)}k`;
  }
  return String(n);
}

/** Start of the comma / newline-delimited tag the caret sits in. */
export function tokenStart(text: string, caret: number): number {
  const upto = text.slice(0, caret);
  return Math.max(upto.lastIndexOf(","), upto.lastIndexOf("\n")) + 1;
}

/**
 * Replace the tag under the caret with `entry`. Parens are escaped
 * a1111-style (bare ones read as prompt-weighting syntax).
 */
export function applyTag(
  text: string,
  caret: number,
  entry: TagEntry
): { text: string; caret: number } {
  const start = tokenStart(text, caret);
  const before = text.slice(0, start);
  const after = text.slice(caret);
  const pad = before && !before.endsWith(" ") ? " " : "";
  const tail = after.trimStart().startsWith(",") ? "" : ", ";
  const display = entry.display.replace(/[()]/g, (c) => `\\${c}`);
  const inserted = before + pad + display + tail;
  return { caret: inserted.length, text: inserted + after.trimStart() };
}
