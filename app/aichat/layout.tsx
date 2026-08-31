import { cookies } from "next/headers";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { AichatProviders } from "@/components/aichat/aichat-providers";
import { AichatSidebar } from "@/components/aichat/aichat-sidebar";
import { AppShellSkeleton } from "@/components/chat/app-shell-skeleton";
import { DataStreamProvider } from "@/components/chat/data-stream-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

// AIchat runs in its own shell — a messenger-style sidebar that shows only
// personas and their chats. The main app sidebar (projects / unclassified)
// is not mounted here.
export default function AichatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DataStreamProvider>
      <Suspense fallback={<AppShellSkeleton />}>
        <AichatShell>{children}</AichatShell>
      </Suspense>
    </DataStreamProvider>
  );
}

async function AichatShell({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const isCollapsed = cookieStore.get("sidebar_state")?.value !== "true";

  return (
    <SidebarProvider
      defaultOpen={!isCollapsed}
      style={{ "--sidebar-width": "24rem" } as React.CSSProperties}
    >
      <AichatSidebar />
      <SidebarInset>
        <Toaster
          position="top-center"
          theme="system"
          toastOptions={{
            className:
              "!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]",
          }}
        />
        <AichatProviders>{children}</AichatProviders>
      </SidebarInset>
    </SidebarProvider>
  );
}
