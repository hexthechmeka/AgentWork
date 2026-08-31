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

// Leading/trailing whitespace + quote marks (straight, smart, Korean) peeled
// off a spoken line so the bubble holds just the words.
const EDGE_QUOTES = /^[\s"“”„‟'‘’「」『』]+|[\s"“”„‟'‘’「」『』]+$/g;

/**
 * Split a roleplay reply on *asterisk* spans: text inside `* *` is narration
 * (italic, outside the bubble); everything else is spoken dialogue and fills
 * a chat bubble. Wrapping quotes on dialogue are stripped.
 */
function parseRoleplay(text: string): Segment[] {
  const segs: Segment[] = [];
  let buf = "";
  let inAster = false;

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
    if (ch === "*") {
      push(inAster ? "narration" : "dialogue");
      inAster = !inAster;
    } else {
      buf += ch;
    }
  }
  push(inAster ? "narration" : "dialogue");

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

function CharacterMessage({
  text,
  persona,
}: {
  text: string;
  persona?: Persona;
}) {
  const cleaned = stripMeta(text) || text;
  const segments = parseRoleplay(cleaned);
  const blocks =
    segments.length > 0
      ? segments
      : [{ kind: "narration" as const, text: cleaned }];

  return (
    <div className="flex flex-row items-start gap-2.5">
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
                    "w-fit max-w-[78%] whitespace-pre-wrap rounded-2xl rounded-br-md px-3.5 py-2 text-[calc(13px_*_var(--aichat-msg-scale,1))] leading-[1.7]",
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
