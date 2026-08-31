"use client";

import {
  ArrowLeftIcon,
  MessageSquarePlusIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
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
  createdAt: string;
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

function Avatar({ persona, size = 26 }: { persona?: Persona; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-sidebar-border bg-sidebar-accent/40 text-[10px] text-sidebar-foreground/60"
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

function ChatRow({
  chat,
  active,
  onOpen,
  onDelete,
}: {
  chat: PersonaChatRow;
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
  return (
    <div
      className={cn(
        "group/chat flex items-center gap-1 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-accent",
        active && "bg-accent"
      )}
    >
      <button
        className="min-w-0 flex-1 truncate text-foreground/90"
        onClick={open}
        type="button"
      >
        {chat.title}
      </button>
      <button
        aria-label="대화 삭제"
        className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/chat:opacity-100"
        onClick={del}
        type="button"
      >
        <Trash2Icon className="size-3.5" />
      </button>
    </div>
  );
}

function PersonaEntry({
  persona,
  chats,
  activeChatId,
  starting,
  onStartNew,
  onOpen,
  onDelete,
}: {
  persona: Persona;
  chats: PersonaChatRow[];
  activeChatId: string | null;
  starting: boolean;
  onStartNew: (persona: Persona) => void;
  onOpen: (chatId: string) => void;
  onDelete: (chat: PersonaChatRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const startNew = useCallback(() => {
    onStartNew(persona);
  }, [onStartNew, persona]);

  return (
    <SidebarMenuItem className="group/persona">
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <SidebarMenuButton className="h-9 items-center gap-2">
            <Avatar persona={persona} />
            <span className="min-w-0 flex-1 truncate text-[13px]">
              {persona.name}
            </span>
            {chats.length > 0 ? (
              <span className="shrink-0 text-[10px] text-sidebar-foreground/40">
                {chats.length}
              </span>
            ) : null}
          </SidebarMenuButton>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-1.5" side="right">
          <div className="flex items-center justify-between px-1.5 py-1">
            <span className="truncate font-medium text-[13px] text-foreground">
              {persona.name}
            </span>
            <Link
              className="rounded p-1 text-muted-foreground hover:text-foreground"
              href={`/aichat/${persona.id}/edit`}
            >
              <PencilIcon className="size-3" />
            </Link>
          </div>

          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            disabled={starting}
            onClick={startNew}
            type="button"
          >
            <MessageSquarePlusIcon className="size-3.5" />새 대화
          </button>

          <div className="mt-1 flex max-h-72 flex-col gap-0.5 overflow-y-auto border-border/60 border-t pt-1">
            {chats.length === 0 ? (
              <p className="px-2 py-2 text-[12px] text-muted-foreground">
                아직 대화가 없습니다.
              </p>
            ) : (
              chats.map((chat) => (
                <ChatRow
                  active={chat.id === activeChatId}
                  chat={chat}
                  key={chat.id}
                  onDelete={onDelete}
                  onOpen={onOpen}
                />
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Link
        className="absolute top-1.5 right-1 rounded p-0.5 text-sidebar-foreground/30 opacity-0 transition-opacity hover:bg-sidebar-accent hover:text-sidebar-foreground group-hover/persona:opacity-100"
        href={`/aichat/${persona.id}`}
      >
        <span className="text-[10px]">상세</span>
      </Link>
    </SidebarMenuItem>
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
            <span className="font-semibold text-[15px] text-sidebar-foreground">
              AIchat
            </span>
            <Link
              className="flex items-center gap-1 rounded-md bg-sidebar-foreground/10 px-2 py-1 text-[12px] text-sidebar-foreground/80 transition-colors hover:bg-sidebar-foreground/15"
              href="/aichat/new"
            >
              <PlusIcon className="size-3.5" />새 캐릭터
            </Link>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-2">
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="px-1 text-[10px] uppercase tracking-[0.12em] text-sidebar-foreground/50">
              캐릭터
            </SidebarGroupLabel>
            <SidebarMenu>
              {personas.length === 0 ? (
                <p className="px-2 py-3 text-[12px] text-sidebar-foreground/40">
                  “새 캐릭터”로 캐릭터를 만들어보세요.
                </p>
              ) : (
                personas.map((persona) => (
                  <PersonaEntry
                    activeChatId={activeChatId}
                    chats={chatsByPersona.get(persona.id) ?? []}
                    key={persona.id}
                    onDelete={confirmDelete}
                    onOpen={openChat}
                    onStartNew={startNew}
                    persona={persona}
                    starting={starting}
                  />
                ))
              )}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="gap-1 border-sidebar-border border-t px-2 pt-2 pb-3">
          <SidebarMenu>
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
