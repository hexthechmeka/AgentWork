"use client";

import { SendIcon, SparklesIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LocalComment = {
  id: string;
  role: "user" | "glm";
  text: string;
};

export function GlmPanel() {
  const [input, setInput] = useState("");
  const [comments, setComments] = useState<LocalComment[]>([]);

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

      setComments((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", text },
      ]);
      setInput("");

      // GLM 호출 로직은 다음 단계에서 구현됩니다.
    },
    [input]
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-border/40 border-b px-4">
        <SparklesIcon className="size-4 text-sidebar-foreground/60" />
        <span className="font-medium text-sm">GLM</span>
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
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-sidebar-foreground/40">
                {comment.role === "user" ? "You" : "GLM"}
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
