import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { AppShellSkeleton } from "@/components/chat/app-shell-skeleton";
import { ImagieSidebar } from "@/components/imagie/imagie-sidebar";
import { ImagieSidebarProvider } from "@/components/imagie/imagie-sidebar-provider";
import { SidebarInset } from "@/components/ui/sidebar";

// Imagie runs in its own shell — a slim nav sidebar with 생성 / 갤러리 / 설정
// that collapses independently of the main chat sidebar (own localStorage
// key, not the shared `sidebar_state` cookie). The main app sidebar is not
// mounted here.
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

  return (
    <ImagieSidebarProvider>
      <ImagieSidebar />
      <SidebarInset className="min-w-0 overflow-x-hidden">
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
    </ImagieSidebarProvider>
  );
}
