"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { DataStreamHandler } from "@/components/chat/data-stream-handler";
import { submitEditedMessage } from "@/components/chat/message-editor";
import { Messages } from "@/components/chat/messages";
import { MultimodalInput } from "@/components/chat/multimodal-input";
import { useActiveChat } from "@/hooks/use-active-chat";
import type { Persona } from "@/lib/db/schema";
import type { Attachment, ChatMessage } from "@/lib/types";
import { fetcher } from "@/lib/utils";
import { getAichatKey } from "./aichat-sidebar";

type AichatResponse = {
  personas: Persona[];
  chats: { id: string; personaId: string | null }[];
};

function PersonaHeader({ persona }: { persona?: Persona }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-border/40 border-b bg-sidebar px-4">
      <span className="flex size-8 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-[10px] text-muted-foreground">
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
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-[14px] text-foreground">
          {persona?.name ?? "AIchat"}
        </span>
        {persona?.tagline ? (
          <span className="truncate text-[11px] text-muted-foreground">
            {persona.tagline}
          </span>
        ) : null}
      </div>
    </header>
  );
}

export function AichatChatPane() {
  const pathname = usePathname();
  const hasChat = pathname?.startsWith("/aichat/chat/") ?? false;

  const {
    chatId,
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    input,
    setInput,
    visibilityType,
    isReadonly,
    isLoading,
    currentModelId,
    setCurrentModelId,
    currentEffort,
    setCurrentEffort,
  } = useActiveChat();

  const { data } = useSWR<AichatResponse>(getAichatKey(), fetcher, {
    revalidateOnFocus: false,
  });
  const activePersonaId = data?.chats.find((c) => c.id === chatId)?.personaId;
  const persona = data?.personas.find((p) => p.id === activePersonaId);

  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null
  );
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const stopRef = useRef(stop);
  stopRef.current = stop;
  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      stopRef.current();
      setEditingMessage(null);
      setAttachments([]);
    }
  }, [chatId]);

  const handleEditMessage = useCallback(
    (msg: ChatMessage) => {
      const text = msg.parts
        ?.filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("");
      setInput(text ?? "");
      setEditingMessage(msg);
    },
    [setInput]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null);
    setInput("");
  }, [setInput]);

  const handleSendEditedMessage = useCallback(async () => {
    if (!editingMessage) {
      return;
    }
    const msg = editingMessage;
    setEditingMessage(null);
    await submitEditedMessage({
      message: msg,
      regenerate,
      setMessages,
      text: input,
    });
    setInput("");
  }, [editingMessage, input, regenerate, setInput, setMessages]);

  if (!hasChat) {
    return (
      <div className="flex h-dvh w-full flex-col items-center justify-center gap-2 bg-background text-center">
        <p className="font-medium text-[15px] text-foreground">AIchat</p>
        <p className="text-[13px] text-muted-foreground">
          왼쪽에서 캐릭터를 골라 대화를 시작하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background">
      <PersonaHeader persona={persona} />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <Messages
          chatId={chatId}
          greeting={
            <div className="flex flex-col items-center gap-3 px-4 text-center">
              <span className="flex size-14 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-[13px] text-muted-foreground">
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
              <p className="font-semibold text-foreground text-lg">
                {persona?.name ?? "AIchat"}
              </p>
              <p className="text-[13px] text-muted-foreground">
                {persona?.tagline ?? "메시지를 보내 대화를 시작하세요."}
              </p>
            </div>
          }
          isArtifactVisible={false}
          isLoading={isLoading}
          isReadonly={isReadonly}
          messages={messages}
          onEditMessage={handleEditMessage}
          regenerate={regenerate}
          selectedModelId={currentModelId}
          setMessages={setMessages}
          status={status}
        />

        <div className="sticky bottom-0 z-1 mx-auto flex w-full max-w-4xl gap-2 bg-background px-2 pb-3 md:px-4 md:pb-4">
          {isReadonly ? null : (
            <MultimodalInput
              attachments={attachments}
              chatId={chatId}
              editingMessage={editingMessage}
              input={input}
              isLoading={isLoading}
              messages={messages}
              onCancelEdit={handleCancelEdit}
              onEffortChange={setCurrentEffort}
              onModelChange={setCurrentModelId}
              selectedEffort={currentEffort}
              selectedModelId={currentModelId}
              selectedVisibilityType={visibilityType}
              sendMessage={
                editingMessage ? handleSendEditedMessage : sendMessage
              }
              setAttachments={setAttachments}
              setInput={setInput}
              setMessages={setMessages}
              status={status}
              stop={stop}
            />
          )}
        </div>
      </div>

      <DataStreamHandler />
    </div>
  );
}
