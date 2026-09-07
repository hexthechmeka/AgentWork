"use client";

import { ImageIcon } from "lucide-react";
import Link from "next/link";
import type { User } from "next-auth";
import { useCallback } from "react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

// Imagie (image generation) has its own full-screen shell. From the main app
// sidebar it's just an entry link.
export function SidebarImagie({ user }: { user: User | undefined }) {
  const { setOpenMobile } = useSidebar();
  const closeMobile = useCallback(() => {
    setOpenMobile(false);
  }, [setOpenMobile]);

  if (!user) {
    return null;
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="h-8 rounded-lg text-[13px] text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            >
              <Link href="/imagie" onClick={closeMobile}>
                <ImageIcon className="size-4" />
                <span className="font-medium">Imagie</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
