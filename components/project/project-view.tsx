"use client";

import { CalendarIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  generateMeetingNotes,
  generateSpecFromNotes,
  reviewSpecWithGlm,
  updateMeetingNotesIncremental,
} from "@/app/project/actions";
import { ModelAvatar } from "@/components/chat/model-badge";
import { ChatShell } from "@/components/chat/shell";
import { toast } from "@/components/chat/toast";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Switch } from "@/components/ui/switch";
import { ActiveChatProvider } from "@/hooks/use-active-chat";
import { DEFAULT_SPEC_MODEL_ID } from "@/lib/ai/models";
import type { Chat } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn, getTextFromMessage } from "@/lib/utils";
import { type GlmComment, GlmPanel } from "./glm-panel";
import { type DocMode, MeetingDocumentPanel } from "./meeting-document-panel";
import { ProjectOverview } from "./project-overview";
import { UnifiedChatPanel } from "./unified-chat-panel";

const MEETING_PANEL_SIZE = 40;
const GLM_PANEL_SIZE = 30;
const PLACEHOLDER_DOC = `# 구현계획서

아직 작성된 내용이 없습니다.

좌측 상단의 "노트 작성"을 누르거나, "미팅 시작"으로 실시간 노트 모드를 켜보세요.
`;

type ProjectTab = "workspace" | "unified";

/**
 * Change the `?chat=` param without a server round-trip. ProjectPage doesn't
 * read searchParams, so this is a pure client transition — useSearchParams()
 * below still re-renders on it.
 */
function setChatParam(projectId: string, chatId: string | null) {
  const url = chatId
    ? `/project/${projectId}?chat=${chatId}`
    : `/project/${projectId}`;
  window.history.pushState(null, "", url);
}

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
  chats,
}: {
  projectId: string;
  projectName: string;
  chats: Chat[];
}) {
  const searchParams = useSearchParams();
  const chatParam = searchParams.get("chat");

  const planningChats = useMemo(
    () => chats.filter((c) => c.kind !== "unified"),
    [chats]
  );
  const unifiedChatId = useMemo(
    () => chats.find((c) => c.kind === "unified")?.id,
    [chats]
  );

  // Overview when there's no `?chat=`; a fresh chat when `?chat=new`;
  // otherwise the requested planning chat (falling back to overview if the
  // id is stale/deleted).
  const isNewChat = chatParam === "new";
  const isUnifiedParam = Boolean(unifiedChatId) && chatParam === unifiedChatId;
  const activeChatId = isNewChat
    ? undefined
    : (planningChats.find((c) => c.id === chatParam)?.id ?? undefined);
  const showOverview = !(isNewChat || activeChatId || isUnifiedParam);

  const goToChat = useCallback(
    (chatId: string | null) => {
      setChatParam(projectId, chatId);
    },
    [projectId]
  );

  const handleNewChat = useCallback(() => {
    setChatParam(projectId, "new");
  }, [projectId]);

  const handleBackToOverview = useCallback(() => {
    setChatParam(projectId, null);
  }, [projectId]);

  const [activeTab, setActiveTab] = useState<ProjectTab>(
    isUnifiedParam ? "unified" : "workspace"
  );

  // Keep the tab in sync when the chat is switched from the overview.
  useEffect(() => {
    if (isUnifiedParam) {
      setActiveTab("unified");
    } else if (activeChatId || isNewChat) {
      setActiveTab("workspace");
    }
  }, [isUnifiedParam, activeChatId, isNewChat]);

  const [isMeetingOpen, setIsMeetingOpen] = useState(false);
  const [isGlmOpen, setIsGlmOpen] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [isMeetingLive, setIsMeetingLive] = useState(false);

  const [docContent, setDocContent] = useState(PLACEHOLDER_DOC);
  const docContentRef = useRef(docContent);
  useEffect(() => {
    docContentRef.current = docContent;
  }, [docContent]);

  const [docMode, setDocMode] = useState<DocMode>("edit");
  const [specModelId, setSpecModelId] = useState(DEFAULT_SPEC_MODEL_ID);
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [isGeneratingSpec, setIsGeneratingSpec] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [glmComments, setGlmComments] = useState<GlmComment[]>([]);

  const toggleMeeting = useCallback(() => {
    setIsMeetingOpen((prev) => !prev);
  }, []);

  const toggleGlm = useCallback(() => {
    setIsGlmOpen((prev) => !prev);
  }, []);

  const toggleMeetingLive = useCallback(() => {
    setIsMeetingLive((prev) => !prev);
    setIsMeetingOpen(true);
  }, []);

  const handleWorkspaceTabClick = useCallback(() => {
    setActiveTab("workspace");
  }, []);

  const handleUnifiedTabClick = useCallback(() => {
    setActiveTab("unified");
  }, []);

  const handleAddGlmComment = useCallback((comment: GlmComment) => {
    setGlmComments((prev) => [...prev, comment]);
  }, []);

  const handleGenerateSpec = useCallback(
    async (notesOverride?: string) => {
      if (!activeChatId) {
        toast({
          description: "먼저 좌측에서 대화를 시작해주세요.",
          type: "error",
        });
        return;
      }

      setIsGeneratingSpec(true);
      setIsMeetingOpen(true);
      try {
        const spec = await generateSpecFromNotes({
          chatId: activeChatId,
          modelId: specModelId,
          notes: notesOverride ?? docContent,
        });
        setDocContent(spec);
        setDocMode("edit");

        if (autoMode) {
          setIsGlmOpen(true);
          setIsReviewing(true);
          try {
            const { annotatedSpec, explanation } = await reviewSpecWithGlm({
              chatId: activeChatId,
              spec,
            });
            setDocContent(annotatedSpec);
            setDocMode("preview");
            handleAddGlmComment({
              id: crypto.randomUUID(),
              role: "glm",
              text: explanation,
            });
          } catch {
            toast({
              description: "기획서 검토에 실패했습니다.",
              type: "error",
            });
          } finally {
            setIsReviewing(false);
          }
        }
      } catch {
        toast({ description: "기획서 작성에 실패했습니다.", type: "error" });
      } finally {
        setIsGeneratingSpec(false);
      }
    },
    [activeChatId, specModelId, docContent, autoMode, handleAddGlmComment]
  );

  const handleWriteNotes = useCallback(async () => {
    if (!activeChatId) {
      toast({
        description: "먼저 좌측에서 대화를 시작해주세요.",
        type: "error",
      });
      return;
    }

    setIsGeneratingNotes(true);
    setIsMeetingOpen(true);
    try {
      const notes = await generateMeetingNotes({ chatId: activeChatId });
      setDocContent(notes);
      setDocMode("edit");

      if (autoMode) {
        await handleGenerateSpec(notes);
      }
    } catch {
      toast({ description: "노트 작성에 실패했습니다.", type: "error" });
    } finally {
      setIsGeneratingNotes(false);
    }
  }, [activeChatId, autoMode, handleGenerateSpec]);

  const handleChatFinished = useCallback(
    ({
      message,
      messages,
    }: {
      message: ChatMessage;
      messages: ChatMessage[];
    }) => {
      if (!isMeetingLive || message.role !== "assistant") {
        return;
      }

      const assistantText = getTextFromMessage(message);
      if (!assistantText.trim()) {
        return;
      }

      const lastUserMessage = [...messages]
        .reverse()
        .find((m) => m.role === "user");
      const userText = lastUserMessage
        ? getTextFromMessage(lastUserMessage)
        : "";

      setIsMeetingOpen(true);
      updateMeetingNotesIncremental({
        assistantText,
        previousNotes: docContentRef.current,
        userText,
      })
        .then(setDocContent)
        .catch(() => {
          // Non-fatal: a single missed live update shouldn't interrupt the chat.
        });
    },
    [isMeetingLive]
  );

  const handleReviewClick = useCallback(async () => {
    if (!activeChatId) {
      toast({
        description: "먼저 좌측에서 대화를 시작해주세요.",
        type: "error",
      });
      return;
    }

    setIsReviewing(true);
    try {
      const { annotatedSpec, explanation } = await reviewSpecWithGlm({
        chatId: activeChatId,
        spec: docContent,
      });
      setDocContent(annotatedSpec);
      setDocMode("preview");
      handleAddGlmComment({
        id: crypto.randomUUID(),
        role: "glm",
        text: explanation,
      });
    } catch {
      toast({ description: "기획서 검토에 실패했습니다.", type: "error" });
    } finally {
      setIsReviewing(false);
    }
  }, [activeChatId, docContent, handleAddGlmComment]);

  const handleGenerateSpecClick = useCallback(() => {
    handleGenerateSpec();
  }, [handleGenerateSpec]);

  const leftPanelSize =
    100 -
    (isMeetingOpen ? MEETING_PANEL_SIZE : 0) -
    (isGlmOpen ? GLM_PANEL_SIZE : 0);

  if (showOverview) {
    return (
      <ProjectOverview
        chats={chats}
        onNewChat={handleNewChat}
        onOpenChat={goToChat}
        projectName={projectName}
      />
    );
  }

  return (
    <div className="flex h-dvh w-full flex-col">
      <div className="flex h-11 shrink-0 items-center gap-3 border-border/40 border-b bg-sidebar px-3">
        <button
          className="rounded-md px-2 py-1 font-medium text-[13px] text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
          onClick={handleBackToOverview}
          type="button"
        >
          ← {projectName}
        </button>

        <div className="flex items-center gap-1">
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

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[12px] text-muted-foreground">자동 모드</span>
          <Switch checked={autoMode} onCheckedChange={setAutoMode} />
        </div>
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
                  chatIdOverride={activeChatId}
                  isGeneratingNotes={isGeneratingNotes}
                  onChatFinished={handleChatFinished}
                  onWriteNotes={handleWriteNotes}
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
                    <MeetingDocumentPanel
                      content={docContent}
                      isGeneratingSpec={isGeneratingSpec}
                      isMeetingLive={isMeetingLive}
                      mode={docMode}
                      onContentChange={setDocContent}
                      onGenerateSpec={handleGenerateSpecClick}
                      onModeChange={setDocMode}
                      onSpecModelChange={setSpecModelId}
                      onToggleLive={toggleMeetingLive}
                      projectName={projectName}
                      specModelId={specModelId}
                    />
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
                    <GlmPanel
                      comments={glmComments}
                      isReviewing={isReviewing}
                      onAddComment={handleAddGlmComment}
                      onReviewClick={handleReviewClick}
                    />
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
