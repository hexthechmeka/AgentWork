"use client";

import { Loader2Icon, SearchCheckIcon, SendIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { ModelAvatar } from "@/components/chat/model-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type GlmComment = {
  id: string;
  role: "user" | "glm";
  text: string;
};

export function GlmPanel({
  comments,
  onAddComment,
  onReviewClick,
  isReviewing,
}: {
  comments: GlmComment[];
  onAddComment: (comment: GlmComment) => void;
  onReviewClick: () => void;
  isReviewing: boolean;
}) {
  const [input, setInput] = useState("");

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInput(e.target.value);
    },
    []
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text) {
        return;
      }

      onAddComment({ id: crypto.randomUUID(), role: "user", text });
      setInput("");

      // GLM 호출 로직은 다음 단계에서 구현됩니다.
    },
    [input, onAddComment]
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-border/40 border-b px-4">
        <ModelAvatar className="size-6 text-[11px]" provider="glm" />
        <span className="font-medium text-sm">GLM</span>
        <Button
          className="ml-auto"
          disabled={isReviewing}
          onClick={onReviewClick}
          size="sm"
          variant="outline"
        >
          {isReviewing ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <SearchCheckIcon className="size-3.5" />
          )}
          기획서 검토
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {comments.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-4 text-center text-[13px] text-sidebar-foreground/40">
            아직 코멘트가 없습니다.
            <br />
            구현계획서가 준비되면 GLM이 여기에 리뷰를 남깁니다.
          </div>
        ) : (
          comments.map((comment) => (
            <div
              className="rounded-lg border border-sidebar-border bg-background/40 px-3 py-2 text-[13px]"
              key={comment.id}
            >
              <div className="mb-1.5 flex items-center gap-1.5">
                {comment.role === "glm" && (
                  <ModelAvatar className="size-4 text-[9px]" provider="glm" />
                )}
                <span className="font-semibold text-[10px] text-sidebar-foreground/40 uppercase tracking-wide">
                  {comment.role === "user" ? "You" : "GLM"}
                </span>
              </div>
              <div className="whitespace-pre-wrap text-sidebar-foreground/90">
                {comment.text}
              </div>
            </div>
          ))
        )}
      </div>

      <form
        className="flex shrink-0 items-center gap-2 overflow-x-auto border-border/40 border-t p-3"
        onSubmit={handleSubmit}
      >
        <Input
          className="min-w-[220px] shrink-0"
          onChange={handleInputChange}
          placeholder="GLM에게 물어보기"
          value={input}
        />
        <Button
          className="shrink-0"
          disabled={!input.trim()}
          size="icon-sm"
          type="submit"
        >
          <SendIcon className="size-4" />
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  );
}
