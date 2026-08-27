"use client";

import { ChatShell } from "@/components/chat/shell";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ActiveChatProvider } from "@/hooks/use-active-chat";
import { GlmPanel } from "./glm-panel";
import { MeetingDocumentPanel } from "./meeting-document-panel";

export function ProjectView({
  projectId,
  projectName,
  existingChatId,
}: {
  projectId: string;
  projectName: string;
  existingChatId?: string;
}) {
  return (
    <ResizablePanelGroup className="h-dvh w-full" direction="horizontal">
      <ResizablePanel
        className="flex min-w-0 flex-col bg-sidebar"
        defaultSize={30}
        minSize={20}
      >
        <ActiveChatProvider
          chatIdOverride={existingChatId}
          projectIdOverride={projectId}
        >
          <ChatShell />
        </ActiveChatProvider>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel
        className="flex min-w-0 flex-col bg-background"
        defaultSize={40}
        minSize={25}
      >
        <MeetingDocumentPanel projectName={projectName} />
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel
        className="flex min-w-0 flex-col bg-sidebar"
        defaultSize={30}
        minSize={20}
      >
        <GlmPanel />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
