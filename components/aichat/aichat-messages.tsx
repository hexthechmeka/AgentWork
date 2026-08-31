"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { RotateCcwIcon } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import type { Persona } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";

function PersonaAvatar({ persona }: { persona?: Persona }) {
  return (
    <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-[11px] text-muted-foreground">
      {persona?.avatarUrl ? (
        // biome-ignore lint/performance/noImgElement: user-uploaded blob avatar
        <img
          alt=""
          className="size-full object-cover"
          src={persona.avatarUrl}
        />
      ) : (
        (persona?.name ?? "AI").slice(0, 2)
      )}
    </span>
  );
}

function messageText(message: ChatMessage): string {
  return (message.parts ?? [])
    .filter(
      (p): p is { type: "text"; text: string } =>
        p.type === "text" && typeof (p as { text?: unknown }).text === "string"
    )
    .map((p) => p.text)
    .join("");
}

type Segment = { kind: "dialogue" | "narration"; text: string };

// Leading/trailing whitespace + quote marks (straight, smart, Korean) peeled
// off a spoken line so the bubble holds just the words.
const EDGE_QUOTES = /^[\s"“”„‟'‘’「」『』]+|[\s"“”„‟'‘’「」『』]+$/g;

// Narration span openers -> their closers ( *asterisks* / ( parens ) ).
const NARRATION_OPENER: Record<string, string> = {
  "(": ")",
  "*": "*",
  "（": "）",
};
// Any of these toggles a quoted (spoken) span. Mixed straight/smart/bracket
// styles all pair up, since we just toggle on "a quote-ish char".
const QUOTE_CHARS = new Set([
  '"',
  "“",
  "”",
  "„",
  "‟",
  "«",
  "»",
  "「",
  "」",
  "『",
  "』",
]);

/**
 * Split a roleplay reply into narration (italic, outside the bubble) and
 * spoken dialogue (the bubble). A quote always wins: text in "quotes" is
 * dialogue even inside a `* *` / `( )` span. If the reply uses quotes at all,
 * unquoted text defaults to narration; otherwise `* *` / `( )` mark narration
 * and everything else is dialogue.
 */
function parseRoleplay(text: string): Segment[] {
  const quoteMode = [...text].filter((c) => QUOTE_CHARS.has(c)).length >= 2;
  const outsideKind: "dialogue" | "narration" = quoteMode
    ? "narration"
    : "dialogue";

  const segs: Segment[] = [];
  let buf = "";
  let spanKind: "" | "dialogue" | "narration" = ""; // "" = outside a span
  let closer = "";

  const push = (kind: "dialogue" | "narration") => {
    let t = buf.trim();
    if (kind === "dialogue") {
      t = t.replace(EDGE_QUOTES, "").trim();
    }
    if (t) {
      segs.push({ kind, text: t });
    }
    buf = "";
  };

  for (const ch of text) {
    if (spanKind === "dialogue") {
      if (QUOTE_CHARS.has(ch)) {
        push("dialogue");
        spanKind = "";
      } else {
        buf += ch;
      }
      continue;
    }
    if (QUOTE_CHARS.has(ch)) {
      push(spanKind === "narration" ? "narration" : outsideKind);
      spanKind = "dialogue";
      closer = "";
      continue;
    }
    if (spanKind === "narration") {
      if (ch === closer) {
        push("narration");
        spanKind = "";
        closer = "";
      } else {
        buf += ch;
      }
      continue;
    }
    if (NARRATION_OPENER[ch]) {
      push(outsideKind);
      spanKind = "narration";
      closer = NARRATION_OPENER[ch];
    } else {
      buf += ch;
    }
  }
  if (spanKind === "dialogue") {
    push("dialogue");
  } else {
    push(spanKind === "narration" ? "narration" : outsideKind);
  }

  const merged: Segment[] = [];
  for (const s of segs) {
    const prev = merged.at(-1);
    if (prev && prev.kind === s.kind) {
      prev.text += (s.kind === "narration" ? "\n" : " ") + s.text;
    } else {
      merged.push({ ...s });
    }
  }
  return merged;
}

// The local roleplay model sometimes prefixes a meta-analysis block
// ("## 분석 … ## 응답 …"). Keep only what follows the reply marker and drop
// stray markdown headers, so the bubble shows the in-character text alone.
function stripMeta(text: string): string {
  let out = text;
  const reply = out.match(/(^|\n)\s*#{0,6}\s*응답\s*[:：]?[ \t]*\n?/);
  if (reply?.index !== undefined) {
    out = out.slice(reply.index + reply[0].length);
  }
  out = out
    .split("\n")
    .filter((line) => !/^\s*#{1,6}\s/.test(line))
    .join("\n");
  return out.trim();
}

// Strip leftover markup the model sometimes emits: [DEV] tags and fragments,
// empty / short bracketed spans, stray square brackets, and chat-template or
// pseudo-HTML tokens (<|...|>, <br>, </i>, <|eot_id|> …).
// Placeholder parentheticals the model uses to skip describing an action.
const SKIP_PLACEHOLDER =
  /[([（]\s*(?:표시\s*(?:하지|되지)?\s*않(?:은|음|는)|묘사\s*(?:생략|안\s*함)|생략|중략|action not shown|hidden|redacted)[^)\]）\n]*[)\]）]/gi;

function stripArtifacts(text: string): string {
  return text
    .replace(/\[dev\][\s\S]*?\[\/dev\]/gi, "") // whole [DEV] … [/DEV] block
    .replace(/\[\s*\/?\s*dev\s*\]/gi, "") // stray/unclosed [DEV] or [/DEV]
    .replace(SKIP_PLACEHOLDER, "") // (표시하지 않은 동작) 등
    .replace(/<[/|]?[a-z0-9_ |]{0,24}>/gi, "") // <|br> </i> <|eot_id|> <|i| >
    .replace(/\[\s*\]/g, "") // empty [ ]
    .replace(/[[\]]/g, "") // strip stray brackets, keep the text between
    .replace(/\s\|\s/g, " ") // orphan pipe
    .replace(/[^\S\n]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function CharacterMessage({
  text,
  persona,
  onReroll,
  busy,
}: {
  text: string;
  persona?: Persona;
  onReroll?: () => void;
  busy?: boolean;
}) {
  const cleaned = stripArtifacts(stripMeta(text)) || text;
  const segments = parseRoleplay(cleaned);
  const blocks =
    segments.length > 0
      ? segments
      : [{ kind: "narration" as const, text: cleaned }];

  return (
    <div className="group/msg flex flex-row items-start gap-2.5">
      <PersonaAvatar persona={persona} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {blocks.map((seg, i) =>
          seg.kind === "dialogue" ? (
            <div
              className="w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-orange-500 px-3.5 py-2 text-[calc(13px_*_var(--aichat-msg-scale,1))] text-white leading-[1.7] dark:bg-orange-500/90"
              // biome-ignore lint/suspicious/noArrayIndexKey: roleplay segments have no stable id
              key={`${i}-d`}
            >
              {seg.text}
            </div>
          ) : (
            <p
              className="whitespace-pre-wrap px-1 text-[calc(13px_*_var(--aichat-msg-scale,1))] text-foreground/70 leading-[1.9]"
              // biome-ignore lint/suspicious/noArrayIndexKey: roleplay segments have no stable id
              key={`${i}-n`}
            >
              {seg.text}
            </p>
          )
        )}
        {onReroll ? (
          <button
            className="mt-0.5 flex w-fit items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 disabled:opacity-40 group-hover/msg:opacity-100"
            disabled={busy}
            onClick={onReroll}
            type="button"
          >
            <RotateCcwIcon className="size-3" />
            {busy ? "생성 중…" : "다시 생성"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function UserMessage({ text }: { text: string }) {
  const segments = parseRoleplay(text);
  const blocks =
    segments.length > 0 ? segments : [{ kind: "dialogue" as const, text }];

  return (
    <div className="flex flex-col items-end gap-1.5">
      {blocks.map((seg, i) =>
        seg.kind === "dialogue" ? (
          <div
            className="w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-blue-500 px-3.5 py-2 text-[calc(13px_*_var(--aichat-msg-scale,1))] text-white leading-[1.7]"
            // biome-ignore lint/suspicious/noArrayIndexKey: roleplay segments have no stable id
            key={`${i}-d`}
          >
            {seg.text}
          </div>
        ) : (
          <p
            className="whitespace-pre-wrap px-1 text-right text-[calc(12px_*_var(--aichat-msg-scale,1))] text-muted-foreground/60 italic leading-relaxed"
            // biome-ignore lint/suspicious/noArrayIndexKey: roleplay segments have no stable id
            key={`${i}-n`}
          >
            {seg.text}
          </p>
        )
      )}
    </div>
  );
}

function TypingBubble({ persona }: { persona?: Persona }) {
  return (
    <div className="flex flex-row items-end gap-2">
      <PersonaAvatar persona={persona} />
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-muted px-3.5 py-3">
        {["a", "b", "c"].map((k, i) => (
          <span
            className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50"
            key={k}
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

export function AichatMessages({
  messages,
  status,
  persona,
  greeting,
  onReroll,
}: {
  messages: ChatMessage[];
  status: UseChatHelpers<ChatMessage>["status"];
  persona?: Persona;
  greeting?: React.ReactNode;
  onReroll?: () => void;
}) {
  const last = messages.at(-1);
  const busy = status === "submitted" || status === "streaming";
  const awaitingReply = busy && last?.role !== "assistant";

  const hasUserTurn = messages.some((m) => m.role === "user");
  let lastAssistantId: string | undefined;
  for (const m of messages) {
    if (m.role === "assistant") {
      lastAssistantId = m.id;
    }
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">{greeting}</div>
    );
  }

  return (
    <Conversation className="flex-1">
      <ConversationContent className="mx-auto flex max-w-3xl flex-col gap-3 px-3 py-5 md:px-4">
        {messages.map((message) => {
          const text = messageText(message);

          if (message.role === "user") {
            if (!text.trim()) {
              return null;
            }
            return <UserMessage key={message.id} text={text} />;
          }

          if (!text.trim()) {
            return <TypingBubble key={message.id} persona={persona} />;
          }
          return (
            <CharacterMessage
              busy={busy}
              key={message.id}
              onReroll={
                onReroll && hasUserTurn && message.id === lastAssistantId
                  ? onReroll
                  : undefined
              }
              persona={persona}
              text={text}
            />
          );
        })}

        {awaitingReply ? <TypingBubble persona={persona} /> : null}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
