"use client";

import { SendIcon, SparklesIcon, WandSparklesIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ImagicianResult } from "@/lib/imagie/imagician";

type Msg = { role: "user" | "assistant"; content: string };
type Proposal = NonNullable<ImagicianResult["proposal"]>;

const ENDPOINT = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/imagie/imagician`;
const ONBOARD_KEY = "imagie.imagician.onboarded";
const GREETING =
  "만들고 싶은 그림을 편하게 말해줘. 예: “노을 지는 옥상에서 난간에 기대 있는 단발 소녀, 애니풍”";

export function ImagicianChat({ onApply }: { onApply: (p: Proposal) => void }) {
  const [onboarded, setOnboarded] = useState(true);
  const [messages, setMessages] = useState<Msg[]>([
    { content: GREETING, role: "assistant" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setOnboarded(localStorage.getItem(ONBOARD_KEY) === "1");
    } catch {
      setOnboarded(true);
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-scroll on every new message
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  const dismissOnboard = useCallback(() => {
    setOnboarded(true);
    try {
      localStorage.setItem(ONBOARD_KEY, "1");
    } catch {
      // best-effort
    }
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) {
      return;
    }
    const next: Msg[] = [...messages, { content: text, role: "user" }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setProposal(null);
    try {
      const res = await fetch(ENDPOINT, {
        body: JSON.stringify({
          messages: next.map((m) => ({ content: m.content, role: m.role })),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("call failed");
      }
      const data = (await res.json()) as ImagicianResult;
      setMessages((m) => [...m, { content: data.reply, role: "assistant" }]);
      if (data.done && data.proposal) {
        setProposal(data.proposal);
      }
    } catch {
      toast.error("생성 도우미 호출에 실패했습니다");
    } finally {
      setBusy(false);
    }
  }, [input, busy, messages]);

  if (!onboarded) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/30 p-4">
        <div className="flex items-center gap-2 font-medium text-[13px]">
          <WandSparklesIcon className="size-4" />
          i-magician
        </div>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          그림 설명을 자연어로 적으면 도우미가 몇 가지 되물은 뒤 danbooru 태그
          프롬프트로 정리해줘. 실사/애니풍에 맞춰 모델도 자동으로 골라줘. 정리된
          결과는 일반 폼에 채워지니 원하는 대로 더 수정하고 생성하면 돼.
        </p>
        <Button className="w-fit" onClick={dismissOnboard} size="sm">
          시작하기
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/60 p-3">
      <div className="flex items-center gap-1.5 font-medium text-[12px] text-muted-foreground">
        <SparklesIcon className="size-3.5" />
        i-magician
      </div>

      <div
        className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1"
        ref={scrollRef}
      >
        {messages.map((m, i) => (
          <div
            className={
              m.role === "user"
                ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-blue-500 px-3 py-1.5 text-[13px] text-white"
                : "mr-auto max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-muted px-3 py-1.5 text-[13px]"
            }
            // biome-ignore lint/suspicious/noArrayIndexKey: chat log is append-only
            key={i}
          >
            {m.content}
          </div>
        ))}
        {busy ? (
          <span className="mr-auto flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Spinner />
            생각 중…
          </span>
        ) : null}
      </div>

      {proposal ? (
        <Button
          className="w-full"
          onClick={() => {
            onApply(proposal);
            toast.success("폼에 채웠어요 — 확인하고 생성하세요");
          }}
          size="sm"
        >
          이 설정으로 폼 채우기 ({proposal.style === "anime" ? "애니" : "실사"}{" "}
          · {proposal.batch}장)
        </Button>
      ) : null}

      <div className="flex items-center gap-2">
        <input
          className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              send();
            }
          }}
          placeholder="설명을 입력…"
          value={input}
        />
        <Button
          className="size-9 shrink-0"
          disabled={busy || !input.trim()}
          onClick={send}
          size="icon"
        >
          <SendIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
