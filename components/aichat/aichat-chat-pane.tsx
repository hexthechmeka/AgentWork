"use client";

import { SlidersHorizontalIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import useSWR, { useSWRConfig } from "swr";
import { DataStreamHandler } from "@/components/chat/data-stream-handler";
import { ModelSelectorCompact } from "@/components/chat/multimodal-input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActiveChat } from "@/hooks/use-active-chat";
import type { Persona } from "@/lib/db/schema";
import { fetcher } from "@/lib/utils";
import { AichatComposer } from "./aichat-composer";
import { AichatMessages } from "./aichat-messages";
import { getAichatKey } from "./aichat-sidebar";

type AichatResponse = {
  personas: Persona[];
  chats: {
    id: string;
    personaId: string | null;
    playerPersonaId: string | null;
  }[];
};

const PLAYER_PERSONAS_KEY = `${
  process.env.NEXT_PUBLIC_BASE_PATH ?? ""
}/api/player-personas`;

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

function PersonaPanel({ persona }: { persona?: Persona }) {
  if (!persona) {
    return null;
  }
  const cover = persona.panelImageUrl ?? persona.avatarUrl;
  return (
    <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto border-border/40 border-r bg-sidebar lg:flex">
      <div className="relative aspect-[3/4] w-full shrink-0 overflow-hidden bg-muted">
        {cover ? (
          // biome-ignore lint/performance/noImgElement: user-uploaded blob art
          <img
            alt={persona.name}
            className="size-full object-cover"
            src={cover}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-2xl text-muted-foreground">
            {persona.name.slice(0, 2)}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3">
          <p className="font-semibold text-[15px] text-white leading-tight">
            {persona.name}
          </p>
          {persona.tagline ? (
            <p className="mt-0.5 text-[11px] text-white/70">
              {persona.tagline}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-2 p-3">
        {persona.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {persona.tags.map((t) => (
              <span
                className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                key={t}
              >
                #{t}
              </span>
            ))}
          </div>
        ) : null}
        <Link
          className="text-[11px] text-muted-foreground hover:text-foreground"
          href={`/aichat/${persona.id}`}
        >
          캐릭터 상세 보기
        </Link>
      </div>
    </aside>
  );
}

function PlayerPersonaField({
  chatId,
  activeId,
}: {
  chatId: string;
  activeId: string | null;
}) {
  const { mutate } = useSWRConfig();
  const { data } = useSWR<{
    playerPersonas: { id: string; name: string }[];
  }>(PLAYER_PERSONAS_KEY, fetcher, { revalidateOnFocus: false });
  const options = data?.playerPersonas ?? [];

  const handleChange = useCallback(
    async (value: string) => {
      const playerPersonaId = value === "none" ? null : value;
      await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/aichat/chat/${chatId}`,
        {
          body: JSON.stringify({ playerPersonaId }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        }
      );
      mutate(getAichatKey());
    },
    [chatId, mutate]
  );

  return (
    <Select onValueChange={handleChange} value={activeId ?? "none"}>
      <SelectTrigger className="h-8 text-[12px]" size="sm">
        <SelectValue placeholder="없음" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">없음</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ChatSettingsToolbar({
  chatId,
  selectedModelId,
  onModelChange,
  personaId,
  activePlayerPersonaId,
}: {
  chatId: string;
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
  personaId?: string;
  activePlayerPersonaId: string | null;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label="채팅방 설정"
          className="size-8 rounded-full border border-border/40 bg-card/80 text-muted-foreground shadow-sm hover:text-foreground"
          size="icon"
          variant="ghost"
        >
          <SlidersHorizontalIcon className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="flex w-64 flex-col gap-3 p-3"
        sideOffset={8}
      >
        <p className="font-medium text-[13px] text-foreground">채팅방 설정</p>
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] text-muted-foreground">모델</span>
          <ModelSelectorCompact
            onModelChange={onModelChange}
            selectedModelId={selectedModelId}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] text-muted-foreground">
            나의 페르소나
          </span>
          <PlayerPersonaField
            activeId={activePlayerPersonaId}
            chatId={chatId}
          />
          <Link
            className="text-[11px] text-muted-foreground hover:text-foreground"
            href="/aichat/me"
          >
            ＋ 페르소나 관리
          </Link>
        </div>
        {personaId ? (
          <Link
            className="text-[12px] text-muted-foreground hover:text-foreground"
            href={`/aichat/${personaId}/edit`}
          >
            캐릭터 설정 편집
          </Link>
        ) : null}
      </PopoverContent>
    </Popover>
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
    input,
    setInput,
    isReadonly,
    currentModelId,
    setCurrentModelId,
  } = useActiveChat();

  const { data } = useSWR<AichatResponse>(getAichatKey(), fetcher, {
    revalidateOnFocus: false,
  });
  const activeChat = data?.chats.find((c) => c.id === chatId);
  const persona = data?.personas.find((p) => p.id === activeChat?.personaId);

  const stopRef = useRef(stop);
  stopRef.current = stop;
  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      stopRef.current();
    }
  }, [chatId]);

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
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <PersonaPanel persona={persona} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <PersonaHeader persona={persona} />

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="absolute top-2 right-2 z-10">
            <ChatSettingsToolbar
              activePlayerPersonaId={activeChat?.playerPersonaId ?? null}
              chatId={chatId}
              onModelChange={setCurrentModelId}
              personaId={persona?.id}
              selectedModelId={currentModelId}
            />
          </div>

          <AichatMessages
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
            messages={messages}
            persona={persona}
            status={status}
          />

          <div className="sticky bottom-0 z-1 w-full bg-background">
            {isReadonly ? null : (
              <AichatComposer
                chatId={chatId}
                input={input}
                sendMessage={sendMessage}
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
    </div>
  );
}
