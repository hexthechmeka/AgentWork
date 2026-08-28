"use client";

import { Loader2Icon, PenLineIcon, PlayIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SPEC_MODEL_OPTIONS } from "@/lib/ai/models";

export type DocMode = "edit" | "preview";

export function MeetingDocumentPanel({
  projectName,
  content,
  onContentChange,
  mode,
  onModeChange,
  specModelId,
  onSpecModelChange,
  onGenerateSpec,
  isGeneratingSpec,
  isMeetingLive,
  onToggleLive,
  bottomSlot,
}: {
  projectName: string;
  content: string;
  onContentChange: (value: string) => void;
  mode: DocMode;
  onModeChange: (mode: DocMode) => void;
  specModelId: string;
  onSpecModelChange: (id: string) => void;
  onGenerateSpec: () => void;
  isGeneratingSpec: boolean;
  isMeetingLive: boolean;
  onToggleLive: () => void;
  bottomSlot?: ReactNode;
}) {
  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onContentChange(e.target.value);
    },
    [onContentChange]
  );

  const handleEditClick = useCallback(() => {
    onModeChange("edit");
  }, [onModeChange]);

  const handlePreviewClick = useCallback(() => {
    onModeChange("preview");
  }, [onModeChange]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-border/40 border-b px-4">
        <div className="flex min-w-0 flex-col">
          <span className="font-medium text-sm">미팅 문서</span>
          <span className="truncate text-[11px] text-muted-foreground">
            {projectName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={onToggleLive}
            size="sm"
            variant={isMeetingLive ? "default" : "outline"}
          >
            {isMeetingLive ? (
              <>
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-red-500" />
                </span>
                미팅 진행중
              </>
            ) : (
              <>
                <PlayIcon className="size-3.5" />
                미팅 시작
              </>
            )}
          </Button>
          <button
            className={
              mode === "edit"
                ? "rounded-md bg-muted px-2 py-1 text-[12px] text-foreground"
                : "rounded-md px-2 py-1 text-[12px] text-muted-foreground hover:text-foreground"
            }
            onClick={handleEditClick}
            type="button"
          >
            편집
          </button>
          <button
            className={
              mode === "preview"
                ? "rounded-md bg-muted px-2 py-1 text-[12px] text-foreground"
                : "rounded-md px-2 py-1 text-[12px] text-muted-foreground hover:text-foreground"
            }
            onClick={handlePreviewClick}
            type="button"
          >
            미리보기
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {mode === "edit" ? (
          <Textarea
            className="h-full min-h-full resize-none border-none bg-transparent font-mono text-sm shadow-none focus-visible:ring-0"
            onChange={handleContentChange}
            placeholder="구현계획서를 작성하세요..."
            value={content}
          />
        ) : (
          <div className="[&_code]:rounded-none [&_code]:bg-transparent [&_code]:px-0 [&_code]:font-medium [&_code]:text-red-600 dark:[&_code]:text-red-400">
            <MessageResponse>{content}</MessageResponse>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-border/40 border-t p-3">
        <Select onValueChange={onSpecModelChange} value={specModelId}>
          <SelectTrigger className="h-8 w-[110px] text-[12px]" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SPEC_MODEL_OPTIONS.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          className="flex-1"
          disabled={isGeneratingSpec}
          onClick={onGenerateSpec}
          size="sm"
          variant="outline"
        >
          {isGeneratingSpec ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <PenLineIcon className="size-3.5" />
          )}
          기획서 작성
        </Button>
      </div>

      {/* Reserved for future additions (e.g. version history, comments). */}
      {bottomSlot ? (
        <div className="shrink-0 border-border/40 border-t">{bottomSlot}</div>
      ) : null}
    </div>
  );
}
