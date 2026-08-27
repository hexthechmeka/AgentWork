"use client";

import { SendIcon } from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useState,
} from "react";
import { Messages } from "@/components/chat/messages";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useActiveChat } from "@/hooks/use-active-chat";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";

const GLM_DEFAULT_MODEL_ID = "glm/glm-5.3";

function resolveTaggedMessage(raw: string): { text: string; modelId: string } {
  const glmMatch = raw.match(/^@GLM\s+/i);
  if (glmMatch) {
    return {
      modelId: GLM_DEFAULT_MODEL_ID,
      text: raw.slice(glmMatch[0].length),
    };
  }

  const claudeMatch = raw.match(/^@CLD\s+/i);
  if (claudeMatch) {
    return {
      modelId: DEFAULT_CHAT_MODEL,
      text: raw.slice(claudeMatch[0].length),
    };
  }

  return { modelId: DEFAULT_CHAT_MODEL, text: raw };
}

export function UnifiedChatPanel() {
  const {
    chatId,
    currentModelId,
    isLoading,
    isReadonly,
    messages,
    regenerate,
    sendMessage,
    setMessages,
    status,
  } = useActiveChat();
  const [input, setInput] = useState("");

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      const raw = input.trim();
      if (!raw || status === "streaming" || status === "submitted") {
        return;
      }

      const { modelId, text } = resolveTaggedMessage(raw);
      if (!text.trim()) {
        return;
      }

      sendMessage(
        { parts: [{ text, type: "text" }], role: "user" },
        { body: { selectedChatModel: modelId } }
      );
      setInput("");
    },
    [input, sendMessage, status]
  );

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(event.target.value);
    },
    []
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSubmit(event);
      }
    },
    [handleSubmit]
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Messages
          chatId={chatId}
          isArtifactVisible={false}
          isLoading={isLoading}
          isReadonly={isReadonly}
          messages={messages}
          regenerate={regenerate}
          selectedModelId={currentModelId}
          setMessages={setMessages}
          status={status}
        />
      </div>

      <form
        className="sticky bottom-0 z-1 mx-auto flex w-full max-w-4xl items-end gap-2 border-t-0 bg-background px-2 pb-3 md:px-4 md:pb-4"
        onSubmit={handleSubmit}
      >
        <Textarea
          className="min-h-14 flex-1 resize-none rounded-2xl border border-border/30 bg-card/70 px-4 py-3 text-[13px] leading-relaxed shadow-[var(--shadow-composer)]"
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="메시지를 입력하세요. @GLM 또는 @CLD 로 시작하면 해당 모델에게만 물어봅니다 (예: @GLM 이 코드 리뷰해줘)"
          value={input}
        />
        <Button
          className="h-10 w-10 shrink-0 rounded-xl"
          disabled={
            !input.trim() || status === "streaming" || status === "submitted"
          }
          size="icon"
          type="submit"
        >
          <SendIcon className="size-4" />
        </Button>
      </form>
    </div>
  );
}
