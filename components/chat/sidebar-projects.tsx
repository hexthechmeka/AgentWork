"use client";

import { ChevronRightIcon, FolderIcon, PlusIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { User } from "next-auth";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { updateChatProject } from "@/app/(chat)/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { Chat } from "@/lib/db/schema";
import { fetcher } from "@/lib/utils";
import { ChatItem, type ProjectOption } from "./sidebar-history-item";

export type ProjectWithChats = {
  id: string;
  name: string;
  createdAt: string;
  chatCount: number;
  chats: Chat[];
};

type ProjectsApiResponse = {
  projects: ProjectWithChats[];
  unclassified: Chat[];
};

export function getProjectsKey() {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/projects`;
}

function ProjectItem({
  proj,
  isOpen,
  activeChatId,
  onToggle,
  onOpenProject,
  onNewChatInProject,
  onDeleteChat,
  setOpenMobile,
  projectOptions,
  onMoveToProject,
}: {
  proj: ProjectWithChats;
  isOpen: boolean;
  activeChatId: string | null;
  onToggle: (projectId: string) => void;
  onOpenProject: (proj: ProjectWithChats) => void;
  onNewChatInProject: (projectId: string) => void;
  onDeleteChat: (chatId: string) => void;
  setOpenMobile: (open: boolean) => void;
  projectOptions: ProjectOption[];
  onMoveToProject: (chatId: string, projectId: string) => void;
}) {
  const handleToggle = useCallback(() => {
    onToggle(proj.id);
  }, [onToggle, proj.id]);

  const handleOpen = useCallback(() => {
    onOpenProject(proj);
  }, [onOpenProject, proj]);

  const handleNewChat = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onNewChatInProject(proj.id);
    },
    [onNewChatInProject, proj.id]
  );

  const stopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <Collapsible asChild onOpenChange={handleToggle} open={isOpen}>
      <SidebarMenuItem>
        <SidebarMenuButton
          className="h-8 text-[13px] text-sidebar-foreground/80"
          onClick={handleOpen}
        >
          <FolderIcon className="size-4" />
          <span className="truncate">{proj.name}</span>
          <span className="ml-auto text-[10px] text-sidebar-foreground/40">
            {proj.chatCount}
          </span>
        </SidebarMenuButton>

        <SidebarMenuAction
          className="right-7"
          onClick={handleNewChat}
          showOnHover
          title="이 프로젝트에 새 대화 추가"
        >
          <PlusIcon />
          <span className="sr-only">이 프로젝트에 새 대화 추가</span>
        </SidebarMenuAction>

        <CollapsibleTrigger asChild>
          <SidebarMenuAction
            onClick={stopPropagation}
            title="프로젝트 펼치기/접기"
          >
            <ChevronRightIcon
              className={
                isOpen
                  ? "rotate-90 transition-transform"
                  : "transition-transform"
              }
            />
            <span className="sr-only">펼치기/접기</span>
          </SidebarMenuAction>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <SidebarMenu className="ml-4 border-l border-sidebar-border pl-2">
            {proj.chats.length === 0 ? (
              <div className="px-2 py-1 text-[12px] text-sidebar-foreground/40">
                아직 대화가 없습니다
              </div>
            ) : (
              proj.chats.map((chatItem) => (
                <ChatItem
                  chat={chatItem}
                  isActive={chatItem.id === activeChatId}
                  key={chatItem.id}
                  onDelete={onDeleteChat}
                  onMoveToProject={onMoveToProject}
                  projectOptions={projectOptions}
                  setOpenMobile={setOpenMobile}
                />
              ))
            )}
          </SidebarMenu>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function UnclassifiedSection({
  chats,
  activeChatId,
  onDeleteChat,
  setOpenMobile,
  projectOptions,
  onMoveToProject,
}: {
  chats: Chat[];
  activeChatId: string | null;
  onDeleteChat: (chatId: string) => void;
  setOpenMobile: (open: boolean) => void;
  projectOptions: ProjectOption[];
  onMoveToProject: (chatId: string, projectId: string) => void;
}) {
  if (chats.length === 0) {
    return null;
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
        미분류
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {chats.map((chatItem) => (
            <ChatItem
              chat={chatItem}
              isActive={chatItem.id === activeChatId}
              key={chatItem.id}
              onDelete={onDeleteChat}
              onMoveToProject={onMoveToProject}
              projectOptions={projectOptions}
              setOpenMobile={setOpenMobile}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function SidebarProjects({ user }: { user: User | undefined }) {
  const { setOpenMobile } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeChatId = pathname?.startsWith("/chat/")
    ? pathname.split("/")[2]
    : (pathname?.startsWith("/project/") && searchParams.get("chat")) || null;

  const { data, isLoading, mutate } = useSWR<ProjectsApiResponse>(
    user ? getProjectsKey() : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  const projects = data?.projects ?? [];
  const unclassified = data?.unclassified ?? [];

  const projectOptions = useMemo<ProjectOption[]>(
    () => projects.map((proj) => ({ id: proj.id, name: proj.name })),
    [projects]
  );

  const [openProjectIds, setOpenProjectIds] = useState<Set<string>>(new Set());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const toggleProject = useCallback((projectId: string) => {
    setOpenProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }, []);

  const handleOpenProject = useCallback(
    (proj: ProjectWithChats) => {
      setOpenMobile(false);
      router.push(`/project/${proj.id}`);
    },
    [router, setOpenMobile]
  );

  const handleNewChatInProject = useCallback(
    (projectId: string) => {
      setOpenMobile(false);
      router.push(`/project/${projectId}?chat=new`);
    },
    [router, setOpenMobile]
  );

  const handleShowDeleteDialog = useCallback((chatId: string) => {
    setDeleteId(chatId);
    setShowDeleteDialog(true);
  }, []);

  const handleDelete = useCallback(() => {
    const chatId = deleteId;
    if (!chatId) {
      return;
    }

    setShowDeleteDialog(false);

    const isCurrentChat =
      pathname === `/chat/${chatId}` || chatId === activeChatId;

    if (isCurrentChat) {
      router.replace("/");
    }

    mutate(
      (current) =>
        current && {
          projects: current.projects.map((proj) => ({
            ...proj,
            chatCount: proj.chats.some((c) => c.id === chatId)
              ? proj.chatCount - 1
              : proj.chatCount,
            chats: proj.chats.filter((c) => c.id !== chatId),
          })),
          unclassified: current.unclassified.filter((c) => c.id !== chatId),
        },
      { revalidate: false }
    );

    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat?id=${chatId}`, {
      method: "DELETE",
    });

    toast.success("대화가 삭제되었습니다");
  }, [deleteId, mutate, pathname, router, activeChatId]);

  const handleMoveToProject = useCallback(
    (chatId: string, projectId: string) => {
      mutate(
        (current) => {
          if (!current) {
            return current;
          }

          const movedChat =
            current.unclassified.find((c) => c.id === chatId) ??
            current.projects
              .flatMap((proj) => proj.chats)
              .find((c) => c.id === chatId);

          if (!movedChat) {
            return current;
          }

          const updatedChat = { ...movedChat, projectId };

          return {
            projects: current.projects.map((proj) => {
              if (proj.id === projectId) {
                return {
                  ...proj,
                  chatCount: proj.chatCount + 1,
                  chats: [updatedChat, ...proj.chats],
                };
              }
              return {
                ...proj,
                chatCount: proj.chats.some((c) => c.id === chatId)
                  ? proj.chatCount - 1
                  : proj.chatCount,
                chats: proj.chats.filter((c) => c.id !== chatId),
              };
            }),
            unclassified: current.unclassified.filter((c) => c.id !== chatId),
          };
        },
        { revalidate: false }
      );

      updateChatProject({ chatId, projectId })
        .then(() => {
          toast.success("대화를 프로젝트로 옮겼습니다");
          mutate();
        })
        .catch(() => {
          toast.error("프로젝트 이동에 실패했습니다");
          mutate();
        });
    },
    [mutate]
  );

  if (!user) {
    return (
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupContent>
          <div className="flex w-full flex-row items-center justify-center gap-2 px-2 text-[13px] text-sidebar-foreground/60">
            로그인하면 프로젝트를 저장하고 다시 볼 수 있어요!
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (isLoading) {
    return (
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
          프로젝트
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <div className="flex flex-col gap-0.5 px-1">
            {[44, 32, 28].map((item) => (
              <div
                className="flex h-8 items-center gap-2 rounded-lg px-2"
                key={item}
              >
                <div
                  className="h-3 max-w-(--skeleton-width) flex-1 animate-pulse rounded-md bg-sidebar-foreground/[0.06]"
                  style={
                    { "--skeleton-width": `${item}%` } as React.CSSProperties
                  }
                />
              </div>
            ))}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <>
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
          프로젝트
        </SidebarGroupLabel>
        <SidebarGroupContent>
          {projects.length === 0 ? (
            <div className="flex w-full flex-row items-center justify-center gap-2 px-2 py-1 text-[13px] text-sidebar-foreground/60">
              프로젝트를 만들어 대화를 시작해보세요!
            </div>
          ) : (
            <SidebarMenu>
              {projects.map((proj) => (
                <ProjectItem
                  activeChatId={activeChatId}
                  isOpen={openProjectIds.has(proj.id)}
                  key={proj.id}
                  onDeleteChat={handleShowDeleteDialog}
                  onMoveToProject={handleMoveToProject}
                  onNewChatInProject={handleNewChatInProject}
                  onOpenProject={handleOpenProject}
                  onToggle={toggleProject}
                  proj={proj}
                  projectOptions={projectOptions}
                  setOpenMobile={setOpenMobile}
                />
              ))}
            </SidebarMenu>
          )}
        </SidebarGroupContent>
      </SidebarGroup>

      <UnclassifiedSection
        activeChatId={activeChatId}
        chats={unclassified}
        onDeleteChat={handleShowDeleteDialog}
        onMoveToProject={handleMoveToProject}
        projectOptions={projectOptions}
        setOpenMobile={setOpenMobile}
      />

      <AlertDialog onOpenChange={setShowDeleteDialog} open={showDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>정말 삭제하시겠어요?</AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 되돌릴 수 없습니다. 이 대화가 서버에서 영구적으로
              삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
