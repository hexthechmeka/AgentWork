import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { AppShellSkeleton } from "@/components/chat/app-shell-skeleton";
import { ImagieSidebar } from "@/components/imagie/imagie-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

// Imagie runs in its own shell — a slim sidebar with 생성 / 갤러리 / 설정.
// The main app sidebar (projects / chats) is not mounted here.
export default function ImagieLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <ImagieShell>{children}</ImagieShell>
    </Suspense>
  );
}

async function ImagieShell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const cookieStore = await cookies();
  const isCollapsed = cookieStore.get("sidebar_state")?.value !== "true";

  return (
    <SidebarProvider
      defaultOpen={!isCollapsed}
      style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
    >
      <ImagieSidebar />
      <SidebarInset>
        <Toaster
          position="top-center"
          theme="system"
          toastOptions={{
            className:
              "!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]",
          }}
        />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
