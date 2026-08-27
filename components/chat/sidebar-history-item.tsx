import { FolderInputIcon } from "lucide-react";
import Link from "next/link";
import { memo, useCallback } from "react";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import type { Chat } from "@/lib/db/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";
import {
  CheckCircleFillIcon,
  GlobeIcon,
  LockIcon,
  MoreHorizontalIcon,
  ShareIcon,
  TrashIcon,
} from "./icons";

export type ProjectOption = {
  id: string;
  name: string;
};

const PureChatItem = ({
  chat,
  isActive,
  onDelete,
  setOpenMobile,
  projectOptions,
  onMoveToProject,
}: {
  chat: Chat;
  isActive: boolean;
  onDelete: (chatId: string) => void;
  setOpenMobile: (open: boolean) => void;
  projectOptions?: ProjectOption[];
  onMoveToProject?: (chatId: string, projectId: string) => void;
}) => {
  const { visibilityType, setVisibilityType } = useChatVisibility({
    chatId: chat.id,
    initialVisibilityType: chat.visibility,
  });
  const closeMobile = useCallback(() => {
    setOpenMobile(false);
  }, [setOpenMobile]);

  const handleSetPrivate = useCallback(() => {
    setVisibilityType("private");
  }, [setVisibilityType]);

  const handleSetPublic = useCallback(() => {
    setVisibilityType("public");
  }, [setVisibilityType]);

  const handleDelete = useCallback(() => {
    onDelete(chat.id);
  }, [chat.id, onDelete]);

  const otherProjectOptions = (projectOptions ?? []).filter(
    (proj) => proj.id !== chat.projectId
  );

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        className="h-8 rounded-none text-[13px] text-sidebar-foreground/50 transition-all duration-150 hover:bg-transparent hover:text-sidebar-foreground data-active:bg-transparent data-active:font-normal data-active:text-sidebar-foreground/50 data-[active=true]:text-sidebar-foreground data-[active=true]:font-medium data-[active=true]:border-b data-[active=true]:border-dashed data-[active=true]:border-sidebar-foreground/50"
        isActive={isActive}
      >
        <Link href={`/chat/${chat.id}`} onClick={closeMobile}>
          <span className="truncate">{chat.title}</span>
        </Link>
      </SidebarMenuButton>

      <DropdownMenu modal={true}>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            className="mr-0.5 rounded-md text-sidebar-foreground/50 ring-0 transition-colors duration-150 focus-visible:ring-0 hover:text-sidebar-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            showOnHover={!isActive}
          >
            <MoreHorizontalIcon />
            <span className="sr-only">더보기</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" side="bottom">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer">
              <ShareIcon />
              <span>공유</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuItem
                  className="cursor-pointer flex-row justify-between"
                  onClick={handleSetPrivate}
                >
                  <div className="flex flex-row items-center gap-2">
                    <LockIcon size={12} />
                    <span>비공개</span>
                  </div>
                  {visibilityType === "private" ? (
                    <CheckCircleFillIcon />
                  ) : null}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer flex-row justify-between"
                  onClick={handleSetPublic}
                >
                  <div className="flex flex-row items-center gap-2">
                    <GlobeIcon />
                    <span>공개</span>
                  </div>
                  {visibilityType === "public" ? <CheckCircleFillIcon /> : null}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          {onMoveToProject ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer">
                <FolderInputIcon className="size-4" />
                <span>프로젝트로 이동</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  {otherProjectOptions.length === 0 ? (
                    <div className="px-2 py-1.5 text-[12px] text-muted-foreground">
                      이동할 프로젝트가 없습니다
                    </div>
                  ) : (
                    otherProjectOptions.map((proj) => (
                      <MoveToProjectMenuItem
                        chatId={chat.id}
                        key={proj.id}
                        onMoveToProject={onMoveToProject}
                        projectId={proj.id}
                        projectName={proj.name}
                      />
                    ))
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          ) : null}

          <DropdownMenuItem onSelect={handleDelete} variant="destructive">
            <TrashIcon />
            <span>삭제</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
};

function MoveToProjectMenuItem({
  chatId,
  projectId,
  projectName,
  onMoveToProject,
}: {
  chatId: string;
  projectId: string;
  projectName: string;
  onMoveToProject: (chatId: string, projectId: string) => void;
}) {
  const handleClick = useCallback(() => {
    onMoveToProject(chatId, projectId);
  }, [chatId, projectId, onMoveToProject]);

  return (
    <DropdownMenuItem className="cursor-pointer" onClick={handleClick}>
      <span className="truncate">{projectName}</span>
    </DropdownMenuItem>
  );
}

export const ChatItem = memo(PureChatItem, (prevProps, nextProps) => {
  if (prevProps.isActive !== nextProps.isActive) {
    return false;
  }
  return true;
});
