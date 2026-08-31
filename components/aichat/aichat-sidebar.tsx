"use client";

import { ArrowLeftIcon, PlusIcon, UserPlusIcon } from "lucide-react";
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

function PersonaPickRow({
  persona,
  disabled,
  onPick,
}: {
  persona: Persona;
  disabled: boolean;
  onPick: (persona: Persona) => void;
}) {
  const handleClick = useCallback(() => {
    onPick(persona);
  }, [onPick, persona]);
  return (
    <button
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60 disabled:opacity-50"
      disabled={disabled}
      onClick={handleClick}
      type="button"
    >
      <Avatar persona={persona} size={22} />
      <span className="truncate">{persona.name}</span>
    </button>
  );
}

function Avatar({ persona, size = 28 }: { persona?: Persona; size?: number }) {
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

  const [pickerOpen, setPickerOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  const togglePicker = useCallback(() => {
    setPickerOpen((v) => !v);
  }, []);

  const startWithPersona = useCallback(
    async (persona: Persona) => {
      if (starting) {
        return;
      }
      setStarting(true);
      try {
        setChatModelCookie(persona.defaultModel);
        // Resume the most recent thread with this persona, else start one.
        const existing = chats.find((c) => c.personaId === persona.id);
        if (existing) {
          setPickerOpen(false);
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
        setPickerOpen(false);
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
      <SidebarHeader className="gap-2 px-2 pt-3">
        <div className="flex items-center justify-between px-1">
          <span className="font-semibold text-[15px] text-sidebar-foreground">
            AIchat
          </span>
          <button
            className="flex items-center gap-1 rounded-md bg-sidebar-foreground/10 px-2 py-1 text-[12px] text-sidebar-foreground/80 transition-colors hover:bg-sidebar-foreground/15"
            onClick={togglePicker}
            type="button"
          >
            <PlusIcon className="size-3.5" />새 대화
          </button>
        </div>

        {pickerOpen ? (
          <div className="flex flex-col gap-0.5 rounded-lg border border-sidebar-border bg-sidebar-accent/20 p-1">
            {personas.length === 0 ? (
              <span className="px-2 py-1.5 text-[12px] text-sidebar-foreground/50">
                캐릭터가 없습니다
              </span>
            ) : (
              personas.map((persona) => (
                <PersonaPickRow
                  disabled={starting}
                  key={persona.id}
                  onPick={startWithPersona}
                  persona={persona}
                />
              ))
            )}
          </div>
        ) : null}
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarMenu>
          {chats.length === 0 ? (
            <p className="px-2 py-6 text-center text-[12px] text-sidebar-foreground/40">
              아직 대화가 없습니다.
            </p>
          ) : (
            chats.map((chat) => {
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
            })
          )}
        </SidebarMenu>
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
