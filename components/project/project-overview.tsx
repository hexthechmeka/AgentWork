"use client";

import { formatDistanceToNow } from "date-fns";
import { MessageSquarePlusIcon, MessagesSquareIcon } from "lucide-react";
import { useCallback } from "react";
import type { Chat } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

function ChatRow({
  chat,
  onOpen,
}: {
  chat: Chat;
  onOpen: (chatId: string) => void;
}) {
  const handleClick = useCallback(() => {
    onOpen(chat.id);
  }, [chat.id, onOpen]);

  return (
    <button
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border border-border/50 bg-card/40 px-3.5 py-3 text-left transition-colors",
        "hover:border-border hover:bg-card"
      )}
      onClick={handleClick}
      type="button"
    >
      <MessagesSquareIcon className="size-4 shrink-0 text-muted-foreground/70" />
      <span className="min-w-0 flex-1 truncate font-medium text-[14px] text-foreground">
        {chat.title || "제목 없는 대화"}
      </span>
      <span className="shrink-0 text-[12px] text-muted-foreground/60">
        {formatDistanceToNow(new Date(chat.createdAt), { addSuffix: true })}
      </span>
    </button>
  );
}

export function ProjectOverview({
  projectName,
  chats,
  onOpenChat,
  onNewChat,
}: {
  projectName: string;
  chats: Chat[];
  onOpenChat: (chatId: string) => void;
  onNewChat: () => void;
}) {
  const planningChats = chats
    .filter((c) => c.kind !== "unified")
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  const unifiedChat = chats.find((c) => c.kind === "unified");

  return (
    <div className="h-dvh w-full overflow-y-auto bg-background">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12">
        <header className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="font-semibold text-2xl text-foreground tracking-tight">
              {projectName}
            </h1>
            <p className="text-[13px] text-muted-foreground">
              대화 {planningChats.length}개
              {unifiedChat ? " · 통합 채팅 1개" : ""}
            </p>
          </div>
          <button
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg bg-foreground px-3.5 py-2 font-medium text-[13px] text-background transition-opacity",
              "hover:opacity-90"
            )}
            onClick={onNewChat}
            type="button"
          >
            <MessageSquarePlusIcon className="size-4" />새 대화
          </button>
        </header>

        <section className="flex flex-col gap-2">
          <h2 className="px-1 font-semibold text-[11px] text-muted-foreground/70 uppercase tracking-[0.12em]">
            대화
          </h2>
          {planningChats.length === 0 ? (
            <div className="rounded-lg border border-border/50 border-dashed px-3.5 py-8 text-center text-[13px] text-muted-foreground">
              아직 대화가 없습니다. “새 대화”로 시작해보세요.
            </div>
          ) : (
            planningChats.map((chat) => (
              <ChatRow chat={chat} key={chat.id} onOpen={onOpenChat} />
            ))
          )}
        </section>

        {unifiedChat ? (
          <section className="flex flex-col gap-2">
            <h2 className="px-1 font-semibold text-[11px] text-muted-foreground/70 uppercase tracking-[0.12em]">
              통합 채팅
            </h2>
            <ChatRow chat={unifiedChat} onOpen={onOpenChat} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
