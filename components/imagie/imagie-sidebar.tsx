"use client";

import {
  ArrowLeftIcon,
  ImageIcon,
  SettingsIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  closeGallery,
  openGallery,
  useGalleryOverlay,
} from "@/lib/imagie/gallery-overlay";
import { cn } from "@/lib/utils";

const btnClass = (active: boolean) =>
  cn("h-9 rounded-lg text-[13px]", active && "bg-sidebar-accent font-medium");

export function ImagieSidebar() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { open: galleryOpen } = useGalleryOverlay();
  const onGenerate = pathname === "/imagie" || pathname === "/imagie/";

  // Gallery opens as an overlay on the generate page — no route change, so
  // GenerateView never unmounts. From another route, hop to /imagie first.
  const handleGallery = useCallback(() => {
    if (onGenerate) {
      openGallery();
    } else {
      router.push("/imagie?gallery=1");
    }
  }, [onGenerate, router]);

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
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className={btnClass(onGenerate && !galleryOpen)}
              >
                <Link href="/imagie" onClick={closeGallery}>
                  <SparklesIcon className="size-4" />
                  <span>생성</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                className={btnClass(galleryOpen)}
                onClick={handleGallery}
              >
                <ImageIcon className="size-4" />
                <span>갤러리</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className={btnClass(pathname.startsWith("/imagie/settings"))}
              >
                <Link href="/imagie/settings">
                  <SettingsIcon className="size-4" />
                  <span>설정</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
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
      <SidebarRail />
    </Sidebar>
  );
}
