"use client";

import {
  ArrowLeftIcon,
  ImageIcon,
  SettingsIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const NAV = [
  {
    href: "/imagie",
    icon: SparklesIcon,
    label: "생성",
    match: /^\/imagie\/?$/,
  },
  {
    href: "/imagie/gallery",
    icon: ImageIcon,
    label: "갤러리",
    match: /^\/imagie\/gallery/,
  },
  {
    href: "/imagie/settings",
    icon: SettingsIcon,
    label: "설정",
    match: /^\/imagie\/settings/,
  },
] as const;

export function ImagieSidebar() {
  const pathname = usePathname() ?? "";

  return (
    <Sidebar>
      <SidebarHeader className="px-3 pt-3">
        <Link
          className="flex items-center gap-2 px-1 font-semibold text-[15px] text-foreground"
          href="/imagie"
        >
          <ImageIcon className="size-4" />
          Imagie
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {NAV.map((item) => {
              const active = item.match.test(pathname);
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    className={cn(
                      "h-9 rounded-lg text-[13px]",
                      active && "bg-sidebar-accent font-medium"
                    )}
                  >
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-sidebar-border border-t pt-2 pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="h-8 rounded-lg text-[13px] text-sidebar-foreground/70"
            >
              <Link href="/">
                <ArrowLeftIcon className="size-4" />
                <span>메인으로</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
