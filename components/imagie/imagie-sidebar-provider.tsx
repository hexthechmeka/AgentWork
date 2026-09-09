"use client";

import { useCallback, useEffect, useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getNavOpen, setNavOpen } from "@/lib/imagie/local-settings";

// A SidebarProvider for /imagie that keeps its open/closed state in
// localStorage (`imagie.navOpen`, default collapsed) instead of the shared
// `sidebar_state` cookie — so toggling the Imagie nav doesn't move the main
// chat sidebar, and vice versa.
export function ImagieSidebarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(getNavOpen());
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    setNavOpen(next);
  }, []);

  return (
    <SidebarProvider
      onOpenChange={handleOpenChange}
      open={open}
      style={{ "--sidebar-width": "15rem" } as React.CSSProperties}
    >
      {children}
    </SidebarProvider>
  );
}
