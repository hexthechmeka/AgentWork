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
    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-[9px] text-muted-foreground">
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
          const mine = message.role === "user";
          const text = messageText(message);

          if (!(mine || text.trim())) {
            return <TypingBubble key={message.id} persona={persona} />;
          }

          return (
            <div
              className={cn(
                "flex items-end gap-2",
                mine ? "flex-row-reverse" : "flex-row"
              )}
              key={message.id}
            >
              {mine ? null : <PersonaAvatar persona={persona} />}
              <div
                className={cn(
                  "max-w-[78%] rounded-2xl px-3.5 py-2 text-[13px] leading-[1.7]",
                  mine
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md bg-muted text-foreground"
                )}
              >
                <MessageResponse>{text}</MessageResponse>
              </div>
            </div>
          );
        })}

        {awaitingReply ? <TypingBubble persona={persona} /> : null}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
