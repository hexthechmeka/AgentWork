"use client";

import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MessageSquarePlusIcon,
  PencilIcon,
  PlusIcon,
  SettingsIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { UsageWidget } from "@/components/chat/usage-widget";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { Persona } from "@/lib/db/schema";
import { cn, fetcher } from "@/lib/utils";

type PersonaChatRow = {
  id: string;
  title: string;
  personaId: string | null;
  playerPersonaId: string | null;
  createdAt: string;
  lastMessage: string;
  lastMessageAt: string;
  lastRole: string | null;
};
type AichatResponse = { personas: Persona[]; chats: PersonaChatRow[] };

export function getAichatKey() {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/personas`;
}

function setChatModelCookie(model: string) {
  try {
    // biome-ignore lint/suspicious/noDocumentCookie: matches the app's setCookie pattern
    document.cookie = `chat-model=${encodeURIComponent(model)}; path=/; max-age=31536000`;
  } catch {
    // ignore
  }
}

function Avatar({ persona, size = 32 }: { persona?: Persona; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-sidebar-border bg-sidebar-accent/40 text-[11px] text-sidebar-foreground/60"
      style={{ height: size, width: size }}
    >
      {persona?.avatarUrl ? (
        // biome-ignore lint/performance/noImgElement: user-uploaded blob avatar
        <img
          alt=""
          className="size-full object-cover"
          src={persona.avatarUrl}
        />
      ) : (
        (persona?.name ?? "?").slice(0, 2)
      )}
    </span>
  );
}

function PersonaCard({
  persona,
  selected,
  chatCount,
  onSelect,
}: {
  persona: Persona;
  selected: boolean;
  chatCount: number;
  onSelect: (personaId: string) => void;
}) {
  const pick = useCallback(() => onSelect(persona.id), [onSelect, persona.id]);

  return (
    <button
      className={cn(
        "flex w-[4.5rem] shrink-0 snap-start flex-col items-center gap-1 rounded-xl p-1 transition-colors",
        selected ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50"
      )}
      onClick={pick}
      type="button"
    >
      <span
        className={cn(
          "relative flex size-16 items-center justify-center overflow-hidden rounded-xl border bg-sidebar-accent/40 text-[13px] text-sidebar-foreground/60",
          selected
            ? "border-primary ring-2 ring-primary/40"
            : "border-sidebar-border"
        )}
      >
        {persona.avatarUrl ? (
          // biome-ignore lint/performance/noImgElement: user-uploaded blob avatar
          <img
            alt=""
            className="size-full object-cover"
            src={persona.avatarUrl}
          />
        ) : (
          persona.name.slice(0, 2)
        )}
        {chatCount > 0 ? (
          <span className="absolute right-0.5 bottom-0.5 rounded-full bg-primary px-1 text-[9px] text-primary-foreground leading-tight">
            {chatCount}
          </span>
        ) : null}
      </span>
      <span className="w-full truncate text-center text-[12px] text-sidebar-foreground/80">
        {persona.name}
      </span>
    </button>
  );
}

function PersonaCarousel({
  personas,
  selectedId,
  chatCounts,
  onSelect,
}: {
  personas: Persona[];
  selectedId: string | null;
  chatCounts: Map<string, number>;
  onSelect: (personaId: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const updateEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) {
      return;
    }
    setEdges({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    updateEdges();
    const el = scrollerRef.current;
    if (!el) {
      return;
    }
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateEdges]);

  const scrollLeft = useCallback(() => {
    scrollerRef.current?.scrollBy({ behavior: "smooth", left: -200 });
  }, []);
  const scrollRight = useCallback(() => {
    scrollerRef.current?.scrollBy({ behavior: "smooth", left: 200 });
  }, []);

  return (
    <div className="relative">
      <div
        className="no-scrollbar flex snap-x gap-1.5 overflow-x-auto px-1 pb-1"
        onScroll={updateEdges}
        ref={scrollerRef}
      >
        {personas.map((p) => (
          <PersonaCard
            chatCount={chatCounts.get(p.id) ?? 0}
            key={p.id}
            onSelect={onSelect}
            persona={p}
            selected={p.id === selectedId}
          />
        ))}
      </div>
      {edges.left ? (
        <button
          aria-label="이전 캐릭터"
          className="-translate-y-1/2 absolute top-1/2 left-0 z-10 flex size-6 items-center justify-center rounded-full bg-sidebar text-sidebar-foreground shadow-md ring-1 ring-sidebar-border"
          onClick={scrollLeft}
          type="button"
        >
          <ChevronLeftIcon className="size-4" />
        </button>
      ) : null}
      {edges.right ? (
        <button
          aria-label="다음 캐릭터"
          className="-translate-y-1/2 absolute top-1/2 right-0 z-10 flex size-6 items-center justify-center rounded-full bg-sidebar text-sidebar-foreground shadow-md ring-1 ring-sidebar-border"
          onClick={scrollRight}
          type="button"
        >
          <ChevronRightIcon className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

function ChatRow({
  chat,
  persona,
  active,
  onOpen,
  onDelete,
}: {
  chat: PersonaChatRow;
  persona: Persona;
  active: boolean;
  onOpen: (chatId: string) => void;
  onDelete: (chat: PersonaChatRow) => void;
}) {
  const open = useCallback(() => onOpen(chat.id), [chat.id, onOpen]);
  const del = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(chat);
    },
    [chat, onDelete]
  );

  const when = formatDistanceToNow(new Date(chat.lastMessageAt), {
    addSuffix: true,
  });
  const preview = chat.lastMessage
    ? `${chat.lastRole === "user" ? "나: " : ""}${chat.lastMessage}`
    : "새 대화";

  return (
    <div
      className={cn(
        "group/chat flex items-start gap-2.5 rounded-lg px-2 py-2.5 transition-colors hover:bg-sidebar-accent",
        active && "bg-sidebar-accent"
      )}
    >
      <button
        className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
        onClick={open}
        type="button"
      >
        <Avatar persona={persona} size={40} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate font-medium text-[14px] text-sidebar-foreground">
              {persona.name}
            </span>
            <span className="shrink-0 text-[11px] text-sidebar-foreground/45">
              {when}
            </span>
          </span>
          <span className="line-clamp-2 text-[13px] text-sidebar-foreground/60">
            {preview}
          </span>
        </span>
      </button>
      <button
        aria-label="대화 삭제"
        className="shrink-0 rounded p-1 text-sidebar-foreground/50 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/chat:opacity-100"
        onClick={del}
        type="button"
      >
        <Trash2Icon className="size-3.5" />
      </button>
    </div>
  );
}

export function AichatSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const activeChatId = pathname?.startsWith("/aichat/chat/")
    ? (pathname.split("/")[3] ?? null)
    : null;

  const { data, mutate } = useSWR<AichatResponse>(getAichatKey(), fetcher, {
    revalidateOnFocus: true,
  });
  const personas = useMemo(() => data?.personas ?? [], [data]);
  const chats = useMemo(() => data?.chats ?? [], [data]);
  const chatsByPersona = useMemo(() => {
    const map = new Map<string, PersonaChatRow[]>();
    for (const c of chats) {
      if (!c.personaId) {
        continue;
      }
      const list = map.get(c.personaId) ?? [];
      list.push(c);
      map.set(c.personaId, list);
    }
    return map;
  }, [chats]);
  const chatCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const [id, list] of chatsByPersona) {
      map.set(id, list.length);
    }
    return map;
  }, [chatsByPersona]);

  const activeChatPersonaId =
    chats.find((c) => c.id === activeChatId)?.personaId ?? null;

  const [picked, setPicked] = useState<string | null>(null);
  const selectedPersonaId =
    picked ?? activeChatPersonaId ?? personas[0]?.id ?? null;
  const selectedPersona = personas.find((p) => p.id === selectedPersonaId);
  const selectedChats = selectedPersonaId
    ? (chatsByPersona.get(selectedPersonaId) ?? [])
    : [];

  const [starting, setStarting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PersonaChatRow | null>(null);

  const openChat = useCallback(
    (chatId: string) => {
      router.push(`/aichat/chat/${chatId}`);
    },
    [router]
  );

  const startNew = useCallback(
    async (persona: Persona) => {
      if (starting) {
        return;
      }
      setStarting(true);
      try {
        setChatModelCookie(persona.defaultModel);
        const res = await fetch(`/api/personas/${persona.id}/start`, {
          method: "POST",
        });
        if (!res.ok) {
          throw new Error("start failed");
        }
        const { chatId } = await res.json();
        await mutate();
        router.push(`/aichat/chat/${chatId}`);
      } catch {
        toast.error("대화를 시작하지 못했습니다");
      } finally {
        setStarting(false);
      }
    },
    [mutate, router, starting]
  );

  const startNewSelected = useCallback(() => {
    if (selectedPersona) {
      startNew(selectedPersona);
    }
  }, [selectedPersona, startNew]);

  const confirmDelete = useCallback((chat: PersonaChatRow) => {
    setDeleteTarget(chat);
  }, []);

  const closeDeleteDialog = useCallback((next: boolean) => {
    if (!next) {
      setDeleteTarget(null);
    }
  }, []);

  const runDelete = useCallback(async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) {
      return;
    }
    try {
      const res = await fetch(`/api/chat?id=${target.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("delete failed");
      }
      await mutate();
      toast.success("대화가 삭제되었습니다");
      if (target.id === activeChatId) {
        router.push("/aichat");
      }
    } catch {
      toast.error("삭제에 실패했습니다");
    }
  }, [activeChatId, deleteTarget, mutate, router]);

  return (
    <>
      <Sidebar>
        <SidebarHeader className="gap-0 px-2 pt-3">
          <div className="flex items-center justify-between px-1">
            <Link
              className="rounded-md px-1 py-0.5 font-semibold text-[16px] text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              href="/aichat"
            >
              AIchat
            </Link>
            <Link
              className="flex items-center gap-1 rounded-md bg-sidebar-foreground/10 px-2 py-1 text-[12px] text-sidebar-foreground/80 transition-colors hover:bg-sidebar-foreground/15"
              href="/aichat/new"
            >
              <PlusIcon className="size-3.5" />새 캐릭터
            </Link>
          </div>
        </SidebarHeader>

        <SidebarContent className="gap-3 px-2 py-2">
          {personas.length === 0 ? (
            <p className="px-2 py-3 text-[13px] text-sidebar-foreground/50">
              “새 캐릭터”로 캐릭터를 만들어보세요.
            </p>
          ) : (
            <>
              <PersonaCarousel
                chatCounts={chatCounts}
                onSelect={setPicked}
                personas={personas}
                selectedId={selectedPersonaId}
              />

              {selectedPersona ? (
                <div className="flex min-h-0 flex-1 flex-col gap-2">
                  <div className="flex items-center gap-2 px-1">
                    <Avatar persona={selectedPersona} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-[15px] text-sidebar-foreground">
                        {selectedPersona.name}
                      </span>
                      {selectedPersona.tagline ? (
                        <span className="block truncate text-[12px] text-sidebar-foreground/60">
                          {selectedPersona.tagline}
                        </span>
                      ) : null}
                    </span>
                    <Link
                      className="rounded p-1.5 text-[11px] text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      href={`/aichat/${selectedPersona.id}`}
                    >
                      상세
                    </Link>
                    <Link
                      aria-label="캐릭터 수정"
                      className="rounded p-1.5 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      href={`/aichat/${selectedPersona.id}/edit`}
                    >
                      <PencilIcon className="size-3.5" />
                    </Link>
                  </div>

                  <button
                    className="flex w-full items-center gap-2 rounded-md border border-sidebar-border px-2.5 py-2 text-left text-[13px] text-sidebar-foreground transition-colors hover:bg-sidebar-accent disabled:opacity-50"
                    disabled={starting}
                    onClick={startNewSelected}
                    type="button"
                  >
                    <MessageSquarePlusIcon className="size-4" />새 대화 시작
                  </button>

                  <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
                    {selectedChats.length === 0 ? (
                      <p className="px-2 py-6 text-center text-[13px] text-sidebar-foreground/40">
                        아직 대화가 없습니다.
                      </p>
                    ) : (
                      selectedChats.map((chat) => (
                        <ChatRow
                          active={chat.id === activeChatId}
                          chat={chat}
                          key={chat.id}
                          onDelete={confirmDelete}
                          onOpen={openChat}
                          persona={selectedPersona}
                        />
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </SidebarContent>

        <SidebarFooter className="gap-1 border-sidebar-border border-t px-2 pt-2 pb-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className="h-8 text-[13px] text-sidebar-foreground/50"
              >
                <Link href="/aichat/settings">
                  <SettingsIcon className="size-4" />
                  롤플레이 설정
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className="h-8 text-[13px] text-sidebar-foreground/50"
              >
                <Link href="/">
                  <ArrowLeftIcon className="size-4" />
                  메인으로
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <UsageWidget />
        </SidebarFooter>
      </Sidebar>

      <AlertDialog
        onOpenChange={closeDeleteDialog}
        open={deleteTarget !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이 대화를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.title}” 의 메시지 기록이 영구 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={runDelete}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
