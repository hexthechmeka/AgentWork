"use client";

import { MessageCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";

function setChatModelCookie(model: string) {
  try {
    // biome-ignore lint/suspicious/noDocumentCookie: matches the app's setCookie pattern
    document.cookie = `chat-model=${encodeURIComponent(model)}; path=/; max-age=31536000`;
  } catch {
    // ignore
  }
}

export function ContinueChatButton({
  personaId,
  defaultModel,
  existingChatId,
}: {
  personaId: string;
  defaultModel: string;
  existingChatId?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleClick = useCallback(async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      setChatModelCookie(defaultModel);
      if (existingChatId) {
        router.push(`/aichat/chat/${existingChatId}`);
        return;
      }
      const res = await fetch(`/api/personas/${personaId}/start`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("start failed");
      }
      const { chatId } = await res.json();
      router.push(`/aichat/chat/${chatId}`);
    } catch {
      toast.error("대화를 시작하지 못했습니다");
      setBusy(false);
    }
  }, [busy, defaultModel, existingChatId, personaId, router]);

  return (
    <button
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 py-3 font-semibold text-[15px] text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      disabled={busy}
      onClick={handleClick}
      type="button"
    >
      <MessageCircleIcon className="size-4" />
      {existingChatId ? "대화 이어하기" : "대화 시작하기"}
    </button>
  );
}
