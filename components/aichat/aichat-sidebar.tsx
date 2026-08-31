"use client";

import {
  ArrowLeftIcon,
  PencilIcon,
  PlusIcon,
  UserPlusIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { UsageWidget } from "@/components/chat/usage-widget";
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

function PersonaRow({
  persona,
  busy,
  onStart,
}: {
  persona: Persona;
  busy: boolean;
  onStart: (persona: Persona) => void;
}) {
  const handleClick = useCallback(() => {
    onStart(persona);
  }, [onStart, persona]);
  const stopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <SidebarMenuItem className="group/persona">
      <SidebarMenuButton
        className="h-9 items-center gap-2 disabled:opacity-50"
        disabled={busy}
        onClick={handleClick}
      >
        <Avatar persona={persona} />
        <span className="min-w-0 flex-1 truncate text-[13px]">
          {persona.name}
        </span>
        <Link
          className="shrink-0 rounded p-0.5 text-sidebar-foreground/40 opacity-0 transition-opacity hover:bg-sidebar-accent hover:text-sidebar-foreground group-hover/persona:opacity-100"
          href={`/aichat/${persona.id}/edit`}
          onClick={stopPropagation}
        >
          <PencilIcon className="size-3" />
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AichatSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const activeChatId = pathname?.startsWith("/aichat/chat/")
    ? pathname.split("/")[3]
    : null;

  const { data, mutate } = useSWR<AichatResponse>(getAichatKey(), fetcher, {
    revalidateOnFocus: true,
  });
  const personas = data?.personas ?? [];
  const chats = data?.chats ?? [];
  const personaById = new Map(personas.map((p) => [p.id, p]));

  const [starting, setStarting] = useState(false);

  const startWithPersona = useCallback(
    async (persona: Persona) => {
      if (starting) {
        return;
      }
      setStarting(true);
      try {
        setChatModelCookie(persona.defaultModel);
        const existing = chats.find((c) => c.personaId === persona.id);
        if (existing) {
          router.push(`/aichat/chat/${existing.id}`);
          return;
        }
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
    [chats, mutate, router, starting]
  );

  return (
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
                <PersonaRow
                  busy={starting}
                  key={persona.id}
                  onStart={startWithPersona}
                  persona={persona}
                />
              ))
            )}
          </SidebarMenu>
        </SidebarGroup>

        {chats.length > 0 ? (
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="px-1 text-[10px] uppercase tracking-[0.12em] text-sidebar-foreground/50">
              대화
            </SidebarGroupLabel>
            <SidebarMenu>
              {chats.map((chat) => {
                const persona = chat.personaId
                  ? personaById.get(chat.personaId)
                  : undefined;
                return (
                  <SidebarMenuItem key={chat.id}>
                    <SidebarMenuButton
                      asChild
                      className={cn(
                        "h-auto items-center gap-2 py-2",
                        chat.id === activeChatId &&
                          "bg-sidebar-accent text-sidebar-accent-foreground"
                      )}
                    >
                      <Link href={`/aichat/chat/${chat.id}`}>
                        <Avatar persona={persona} />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium text-[13px]">
                            {persona?.name ?? chat.title}
                          </span>
                          <span className="truncate text-[11px] text-sidebar-foreground/45">
                            {chat.title}
                          </span>
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter className="gap-1 border-sidebar-border border-t px-2 pt-2 pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="h-8 text-[13px]">
              <Link href="/aichat/new">
                <UserPlusIcon className="size-4" />새 캐릭터
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
  );
}
