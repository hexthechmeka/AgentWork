"use client";

import { ChevronsRightIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ImperativePanelGroupHandle } from "react-resizable-panels";
import { ChatShell } from "@/components/chat/shell";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ActiveChatProvider } from "@/hooks/use-active-chat";
import { cn } from "@/lib/utils";
import { GlmPanel } from "./glm-panel";
import { MeetingDocumentPanel } from "./meeting-document-panel";
import { UnifiedChatPanel } from "./unified-chat-panel";

const EXPANDED_LAYOUT = [30, 40, 30];
const COLLAPSED_LAYOUT = [50, 0, 50];

type ProjectTab = "workspace" | "unified";

function TabButton({
  isActive,
  onClick,
  children,
}: {
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={cn(
        "rounded-md px-3 py-1.5 font-medium text-[13px] transition-colors",
        isActive
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

export function ProjectView({
  projectId,
  projectName,
  existingChatId,
  unifiedChatId,
}: {
  projectId: string;
  projectName: string;
  existingChatId?: string;
  unifiedChatId?: string;
}) {
  const [activeTab, setActiveTab] = useState<ProjectTab>("workspace");
  const [isMeetingPanelCollapsed, setIsMeetingPanelCollapsed] = useState(true);
  const panelGroupRef = useRef<ImperativePanelGroupHandle>(null);

  useEffect(() => {
    panelGroupRef.current?.setLayout(
      isMeetingPanelCollapsed ? COLLAPSED_LAYOUT : EXPANDED_LAYOUT
    );
  }, [isMeetingPanelCollapsed]);

  const toggleMeetingPanel = useCallback(() => {
    setIsMeetingPanelCollapsed((prev) => !prev);
  }, []);

  const handleWorkspaceTabClick = useCallback(() => {
    setActiveTab("workspace");
  }, []);

  const handleUnifiedTabClick = useCallback(() => {
    setActiveTab("unified");
  }, []);

  const handleMeetingPanelCollapse = useCallback(() => {
    setIsMeetingPanelCollapsed(true);
  }, []);

  const handleMeetingPanelExpand = useCallback(() => {
    setIsMeetingPanelCollapsed(false);
  }, []);

  return (
    <div className="flex h-dvh w-full flex-col">
      <div className="flex h-11 shrink-0 items-center gap-1 border-border/40 border-b bg-sidebar px-3">
        <TabButton
          isActive={activeTab === "workspace"}
          onClick={handleWorkspaceTabClick}
        >
          작업 뷰
        </TabButton>
        <TabButton
          isActive={activeTab === "unified"}
          onClick={handleUnifiedTabClick}
        >
          통합 채팅
        </TabButton>
      </div>

      <div className="min-h-0 flex-1">
        <div
          className={cn(
            "relative h-full w-full",
            activeTab !== "workspace" && "hidden"
          )}
        >
          <ResizablePanelGroup
            className="h-full w-full"
            direction="horizontal"
            ref={panelGroupRef}
          >
            <ResizablePanel
              className="flex min-w-0 flex-col bg-sidebar"
              defaultSize={COLLAPSED_LAYOUT[0]}
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
              collapsedSize={COLLAPSED_LAYOUT[1]}
              collapsible
              defaultSize={COLLAPSED_LAYOUT[1]}
              minSize={25}
              onCollapse={handleMeetingPanelCollapse}
              onExpand={handleMeetingPanelExpand}
            >
              <MeetingDocumentPanel
                isCollapsed={isMeetingPanelCollapsed}
                onToggleCollapse={toggleMeetingPanel}
                projectName={projectName}
              />
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel
              className="flex min-w-0 flex-col bg-sidebar"
              defaultSize={COLLAPSED_LAYOUT[2]}
              minSize={20}
            >
              <GlmPanel />
            </ResizablePanel>
          </ResizablePanelGroup>

          {isMeetingPanelCollapsed ? (
            <button
              aria-label="미팅 문서 펼치기"
              className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 z-20 flex size-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-md hover:text-foreground"
              onClick={toggleMeetingPanel}
              type="button"
            >
              <ChevronsRightIcon className="size-3.5" />
            </button>
          ) : null}
        </div>

        <div
          className={cn("h-full w-full", activeTab !== "unified" && "hidden")}
        >
          <ActiveChatProvider
            chatIdOverride={unifiedChatId}
            chatKindOverride="unified"
            projectIdOverride={projectId}
          >
            <UnifiedChatPanel />
          </ActiveChatProvider>
        </div>
      </div>
    </div>
  );
}
