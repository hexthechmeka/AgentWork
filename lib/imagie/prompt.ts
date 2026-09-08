// Multi-field prompt model (spec §6). The UI always edits this structure —
// whether the user fills it by hand or (Pass 2) an LLM wizard produces it —
// and `joinPromptFields` flattens it to the single danbooru-tag string the
// backend's `GenerateRequest.prompt` expects.

export type CharacterField = {
  /** Free text: name / franchise, e.g. "ahri \(league of legends\)". */
  name?: string;
  /** Appearance + outfit tags. */
  appearance?: string;
};

export type PromptFields = {
  /**
   * Verbatim prompt override. When non-empty the structured fields below are
   * ignored — used by "이 설정으로 다시 생성" (which only has the flattened
   * string) and by anyone who'd rather just type one prompt.
   */
  raw?: string;
  /** ① artist / style tags. */
  artist?: string;
  /** ② one or more characters. */
  characters: CharacterField[];
  /** ③ pose / expression. */
  pose?: string;
  /** ④ composition: shot type / camera angle. */
  composition?: string;
  /** ⑤ background / detail. */
  background?: string;
};

export const EMPTY_PROMPT_FIELDS: PromptFields = {
  artist: "",
  background: "",
  characters: [{ appearance: "", name: "" }],
  composition: "",
  pose: "",
  raw: "",
};

export const DEFAULT_NEGATIVE =
  "blurry, lowres, aliasing, error, artistic error, film grain, scan, scan artifacts, worst quality, bad quality, unfinished, jpeg artifacts, very displeasing, displeasing, chromatic aberration, multiple views, comic, dated, signature, artist name, username, logo, artist logo, watermark, too many watermarks, white blank page, blank page";

const COUNT_TAG: Record<number, string> = {
  1: "1girl",
  2: "2girls",
  3: "3girls",
  4: "4girls",
  5: "5girls",
};

function clean(s?: string): string {
  return (s ?? "")
    .trim()
    .replace(/\s*,\s*/g, ", ")
    .replace(/,\s*$/g, "")
    .trim();
}

function joinChar(c: CharacterField): string {
  return [clean(c.name), clean(c.appearance)].filter(Boolean).join(", ");
}

/**
 * Flatten the structured fields to one comma-joined tag string.
 *
 * With 2+ named/described characters we prepend the danbooru head-count tag
 * (`2girls`, …) and list each character's block in order — the convention
 * illustrious/danbooru models are trained on.
 */
export function joinPromptFields(f: PromptFields): string {
  const raw = clean(f.raw);
  if (raw) {
    return raw;
  }

  const parts: string[] = [];

  if (clean(f.artist)) {
    parts.push(clean(f.artist));
  }

  const chars = f.characters.map(joinChar).filter(Boolean);
  if (chars.length >= 2) {
    parts.push(COUNT_TAG[chars.length] ?? `${chars.length}girls`);
  }
  parts.push(...chars);

  for (const seg of [f.pose, f.composition, f.background]) {
    if (clean(seg)) {
      parts.push(clean(seg));
    }
  }

  return parts.join(", ");
}

/** True when the structured fields carry nothing worth sending. */
export function isPromptEmpty(f: PromptFields): boolean {
  return joinPromptFields(f).length === 0;
}
