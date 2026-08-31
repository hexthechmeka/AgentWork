"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { ArrowUpIcon } from "lucide-react";
import { type Dispatch, type SetStateAction, useCallback, useRef } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { StopIcon } from "@/components/chat/icons";
import type { ChatMessage } from "@/lib/types";
import { cn, fetcher } from "@/lib/utils";

const HARD_LOCK_MESSAGE =
  "한도에 도달하여 메시지를 전송할 수 없습니다. 한도 재설정이 필요합니다.";
const MAX_TEXTAREA_HEIGHT = 140;

/**
 * Messenger-style composer for the AIchat pane: a single rounded pill with an
 * auto-growing textarea and a round send button. No attachments, slash
 * commands, model or effort selectors — those live in the chat-room settings
 * toolbar instead.
 */
export function AichatComposer({
  chatId,
  input,
  setInput,
  status,
  stop,
  sendMessage,
  setMessages,
}: {
  chatId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>["status"];
  stop: () => void;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: usageData } = useSWR<{
    providers: { provider: string; hardLocked: boolean }[];
  }>("/api/usage", fetcher, { refreshInterval: 30_000 });
  const hardLocked = Boolean(
    usageData?.providers?.find((p) => p.provider === "aichat")?.hardLocked
  );

  const busy = status === "submitted" || status === "streaming";

  const resetHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, []);

  const submit = useCallback(() => {
    if (hardLocked) {
      toast.error(HARD_LOCK_MESSAGE);
      return;
    }
    const text = input.trim();
    if (!text || busy) {
      return;
    }
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    window.history.pushState({}, "", `${basePath}/aichat/chat/${chatId}`);
    sendMessage({ parts: [{ text, type: "text" }], role: "user" });
    setInput("");
    resetHeight();
  }, [busy, chatId, hardLocked, input, resetHeight, sendMessage, setInput]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== "Enter" || e.shiftKey) {
        return;
      }
      // Korean/IME: an Enter that commits a composition (isComposing / the
      // legacy keyCode 229 sentinel) must not also send — the next Enter does.
      if (e.nativeEvent.isComposing || e.keyCode === 229) {
        return;
      }
      e.preventDefault();
      submit();
    },
    [submit]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
    },
    [setInput]
  );

  const handleStop = useCallback(() => {
    stop();
    setMessages((m) => m);
  }, [setMessages, stop]);

  const canSend = Boolean(input.trim()) && !hardLocked;

  return (
    <div className="mx-auto w-full max-w-3xl px-3 pb-3 md:px-4 md:pb-4">
      {hardLocked ? (
        <div className="mb-2 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[12px] text-red-600 dark:text-red-400">
          {HARD_LOCK_MESSAGE}
        </div>
      ) : null}
      <div className="flex items-end gap-2 rounded-3xl border border-border/50 bg-card/80 py-1.5 pr-1.5 pl-4 shadow-[var(--shadow-composer)] transition-shadow focus-within:shadow-[var(--shadow-composer-focus)]">
        <textarea
          className="max-h-[140px] flex-1 resize-none bg-transparent py-1.5 text-[13px] leading-relaxed outline-none placeholder:text-muted-foreground/40"
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={hardLocked ? HARD_LOCK_MESSAGE : "메시지 보내기…"}
          ref={textareaRef}
          rows={1}
          value={input}
        />
        {busy ? (
          <button
            aria-label="응답 중지"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform active:scale-95"
            onClick={handleStop}
            type="button"
          >
            <StopIcon size={14} />
          </button>
        ) : (
          <button
            aria-label="보내기"
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full transition-all active:scale-95",
              canSend
                ? "bg-blue-500 text-white hover:bg-blue-600"
                : "cursor-not-allowed bg-muted text-muted-foreground/30"
            )}
            disabled={!canSend}
            onClick={submit}
            type="button"
          >
            <ArrowUpIcon className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
