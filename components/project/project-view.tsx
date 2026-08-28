"use client";

import { CalendarIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { ModelAvatar } from "@/components/chat/model-badge";
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

const MEETING_PANEL_SIZE = 40;
const GLM_PANEL_SIZE = 30;

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

function AccordionTab({
  isOpen,
  onClick,
  icon,
  label,
}: {
  isOpen: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      aria-expanded={isOpen}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium text-[12px] transition-colors",
        isOpen
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      )}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
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
  const [isMeetingOpen, setIsMeetingOpen] = useState(false);
  const [isGlmOpen, setIsGlmOpen] = useState(false);

  const toggleMeeting = useCallback(() => {
    setIsMeetingOpen((prev) => !prev);
  }, []);

  const toggleGlm = useCallback(() => {
    setIsGlmOpen((prev) => !prev);
  }, []);

  const handleWorkspaceTabClick = useCallback(() => {
    setActiveTab("workspace");
  }, []);

  const handleUnifiedTabClick = useCallback(() => {
    setActiveTab("unified");
  }, []);

  const leftPanelSize =
    100 -
    (isMeetingOpen ? MEETING_PANEL_SIZE : 0) -
    (isGlmOpen ? GLM_PANEL_SIZE : 0);

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
            "flex h-full w-full flex-col",
            activeTab !== "workspace" && "hidden"
          )}
        >
          <div className="flex h-9 shrink-0 items-center gap-1 border-border/40 border-b bg-background px-2">
            <AccordionTab
              icon={<CalendarIcon className="size-3.5" />}
              isOpen={isMeetingOpen}
              label="미팅 문서"
              onClick={toggleMeeting}
            />
            <AccordionTab
              icon={
                <ModelAvatar className="size-4 text-[9px]" provider="glm" />
              }
              isOpen={isGlmOpen}
              label="GLM"
              onClick={toggleGlm}
            />
          </div>

          <div className="min-h-0 flex-1">
            <ResizablePanelGroup
              className="h-full w-full"
              direction="horizontal"
              key={`${isMeetingOpen}-${isGlmOpen}`}
            >
              <ResizablePanel
                className="flex min-w-0 flex-col bg-sidebar"
                defaultSize={leftPanelSize}
                minSize={20}
              >
                <ActiveChatProvider
                  chatIdOverride={existingChatId}
                  projectIdOverride={projectId}
                >
                  <ChatShell />
                </ActiveChatProvider>
              </ResizablePanel>

              {isMeetingOpen ? (
                <>
                  <ResizableHandle withHandle />
                  <ResizablePanel
                    className="flex min-w-0 flex-col bg-background"
                    defaultSize={MEETING_PANEL_SIZE}
                    minSize={25}
                  >
                    <MeetingDocumentPanel projectName={projectName} />
                  </ResizablePanel>
                </>
              ) : null}

              {isGlmOpen ? (
                <>
                  <ResizableHandle withHandle />
                  <ResizablePanel
                    className="flex min-w-0 flex-col bg-sidebar"
                    defaultSize={GLM_PANEL_SIZE}
                    minSize={20}
                  >
                    <GlmPanel />
                  </ResizablePanel>
                </>
              ) : null}
            </ResizablePanelGroup>
          </div>
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
