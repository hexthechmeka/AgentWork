"use client";

import { SparklesIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "next-auth";
import { useCallback } from "react";
import useSWR from "swr";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { fetcher } from "@/lib/utils";

type PersonaChat = { id: string; title: string };
type AichatResponse = {
  personas: { id: string; name: string }[];
  chats: PersonaChat[];
};

export function getAichatKey() {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/personas`;
}

export function SidebarAichat({ user }: { user: User | undefined }) {
  const { setOpenMobile } = useSidebar();
  const pathname = usePathname();
  const activeChatId = pathname?.startsWith("/chat/")
    ? pathname.split("/")[2]
    : null;

  const { data } = useSWR<AichatResponse>(
    user ? getAichatKey() : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const closeMobile = useCallback(() => {
    setOpenMobile(false);
  }, [setOpenMobile]);

  if (!user) {
    return null;
  }

  const chats = data?.chats ?? [];

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
        AIchat
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="h-8 text-[13px] text-sidebar-foreground/70"
            >
              <Link href="/aichat" onClick={closeMobile}>
                <SparklesIcon className="size-4" />
                <span>캐릭터 갤러리</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {chats.map((chat) => (
            <SidebarMenuItem key={chat.id}>
              <SidebarMenuButton
                asChild
                className="h-8 rounded-none text-[13px] text-sidebar-foreground/50 data-[active=true]:text-sidebar-foreground data-[active=true]:font-medium"
                isActive={chat.id === activeChatId}
              >
                <Link href={`/chat/${chat.id}`} onClick={closeMobile}>
                  <span className="truncate">{chat.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
