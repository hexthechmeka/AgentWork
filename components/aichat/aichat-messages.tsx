"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { MessageResponse } from "@/components/ai-elements/message";
import type { Persona } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

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
// straight ", smart “ ”, Korean 「 」 『 』
const OPEN_QUOTES = new Set(['"', "“", "「", "『"]);
const CLOSE_QUOTES = new Set(['"', "”", "」", "』"]);

/**
 * Split a roleplay reply into spoken lines (inside quotes → chat bubble) and
 * everything else (narration / *actions* → italic, outside the bubble).
 * Text wrapped in *asterisks* is always narration, even if it contains
 * quotes. An unterminated quote at the end (mid-stream) stays "dialogue" so
 * it fills a bubble as it arrives.
 */
function parseRoleplay(text: string): Segment[] {
  const segs: Segment[] = [];
  let buf = "";
  let mode: "narration" | "dialogue" | "aster" = "narration";

  const push = (kind: "dialogue" | "narration") => {
    const t = buf.trim();
    if (t) {
      segs.push({ kind, text: t });
    }
    buf = "";
  };

  for (const ch of text) {
    if (mode === "aster") {
      if (ch === "*") {
        push("narration");
        mode = "narration";
      } else {
        buf += ch;
      }
      continue;
    }
    if (mode === "dialogue") {
      if (CLOSE_QUOTES.has(ch)) {
        push("dialogue");
        mode = "narration";
      } else {
        buf += ch;
      }
      continue;
    }
    if (ch === "*") {
      push("narration");
      mode = "aster";
    } else if (OPEN_QUOTES.has(ch)) {
      push("narration");
      mode = "dialogue";
    } else {
      buf += ch;
    }
  }
  push(mode === "dialogue" ? "dialogue" : "narration");

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

function CharacterMessage({
  text,
  persona,
}: {
  text: string;
  persona?: Persona;
}) {
  const segments = parseRoleplay(text);
  const blocks =
    segments.length > 0 ? segments : [{ kind: "narration" as const, text }];

  return (
    <div className="flex flex-row items-start gap-2">
      <PersonaAvatar persona={persona} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {blocks.map((seg, i) =>
          seg.kind === "dialogue" ? (
            <div
              className="w-fit max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-orange-500 px-3.5 py-2 text-[13px] text-white leading-[1.7] dark:bg-orange-500/90"
              // biome-ignore lint/suspicious/noArrayIndexKey: roleplay segments have no stable id
              key={`${i}-d`}
            >
              {seg.text}
            </div>
          ) : (
            <p
              className="whitespace-pre-wrap px-1 text-[12px] text-muted-foreground italic leading-relaxed"
              // biome-ignore lint/suspicious/noArrayIndexKey: roleplay segments have no stable id
              key={`${i}-n`}
            >
              {seg.text}
            </p>
          )
        )}
      </div>
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
}: {
  messages: ChatMessage[];
  status: UseChatHelpers<ChatMessage>["status"];
  persona?: Persona;
  greeting?: React.ReactNode;
}) {
  const last = messages.at(-1);
  const awaitingReply =
    (status === "submitted" || status === "streaming") &&
    last?.role !== "assistant";

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
            return (
              <div className="flex flex-row-reverse" key={message.id}>
                <div
                  className={cn(
                    "w-fit max-w-[78%] whitespace-pre-wrap rounded-2xl rounded-br-md px-3.5 py-2 text-[13px] leading-[1.7]",
                    "bg-blue-500 text-white"
                  )}
                >
                  <MessageResponse>{text}</MessageResponse>
                </div>
              </div>
            );
          }

          if (!text.trim()) {
            return <TypingBubble key={message.id} persona={persona} />;
          }
          return (
            <CharacterMessage key={message.id} persona={persona} text={text} />
          );
        })}

        {awaitingReply ? <TypingBubble persona={persona} /> : null}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
