"use client";

import {
  CircleCheckIcon,
  CircleXIcon,
  Loader2Icon,
  TerminalIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type DevEvent = {
  type:
    | "step"
    | "tool_call"
    | "tool_result"
    | "done"
    | "error"
    | "blocked"
    | "info";
  message?: string;
  n?: number;
  name?: string;
  summary?: string;
};
type Status = "idle" | "running" | "done" | "error";

const jobKey = (projectId: string) => `dev.job.${projectId}`;
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function lineFor(e: DevEvent): { text: string; tone: string } {
  switch (e.type) {
    case "step":
      return {
        text: `▸ step ${e.n ?? ""} ${e.message ?? ""}`.trim(),
        tone: "text-foreground",
      };
    case "tool_call":
      return {
        text: `  ⚙ ${e.name}(${e.summary ?? ""})`,
        tone: "text-blue-500",
      };
    case "tool_result":
      return {
        text: `  ↳ ${e.summary ?? e.message ?? ""}`,
        tone: "text-muted-foreground",
      };
    case "done":
      return {
        text: `✔ 완료 ${e.summary ?? e.message ?? ""}`.trim(),
        tone: "text-emerald-500",
      };
    case "error":
      return {
        text: `✖ 오류: ${e.message ?? "알 수 없음"}`,
        tone: "text-destructive",
      };
    case "blocked":
      return {
        text: `⏸ ${e.message ?? "사용량 한도 도달로 중단됨"}`,
        tone: "text-amber-500",
      };
    default:
      return { text: e.message ?? "", tone: "text-muted-foreground" };
  }
}

export function DevConsole({
  projectId,
  open,
  onClose,
  initialInstruction = "",
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
  initialInstruction?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [events, setEvents] = useState<DevEvent[]>([]);
  const [instruction, setInstruction] = useState(initialInstruction);
  const esRef = useRef<EventSource | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const subscribe = useCallback(
    (jobId: string) => {
      esRef.current?.close();
      const es = new EventSource(`${BASE}/api/dev/stream/${jobId}`);
      esRef.current = es;
      setStatus("running");
      es.onmessage = (msg) => {
        let ev: DevEvent;
        try {
          ev = JSON.parse(msg.data);
        } catch {
          return;
        }
        setEvents((prev) => [...prev, ev]);
        if (ev.type === "done") {
          setStatus("done");
          es.close();
          try {
            localStorage.removeItem(jobKey(projectId));
          } catch {
            // ignore
          }
        } else if (ev.type === "error" || ev.type === "blocked") {
          setStatus(ev.type === "error" ? "error" : "done");
        }
      };
      es.onerror = () => {
        // network blip — EventSource auto-retries; only flip to error if the
        // job never produced anything.
        setEvents((prev) =>
          prev.length === 0
            ? [{ message: "스트림 연결 끊김 (재시도 중)", type: "error" }]
            : prev
        );
      };
    },
    [projectId]
  );

  // re-attach to an in-flight job after a reload
  useEffect(() => {
    try {
      const jobId = localStorage.getItem(jobKey(projectId));
      if (jobId) {
        subscribe(jobId);
      }
    } catch {
      // ignore
    }
    return () => esRef.current?.close();
  }, [projectId, subscribe]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on each new event
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [events.length]);

  const onInstructionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInstruction(e.target.value);
    },
    []
  );

  const start = useCallback(async () => {
    if (!instruction.trim() || status === "running") {
      return;
    }
    setEvents([]);
    setStatus("running");
    try {
      const res = await fetch(`${BASE}/api/dev/start`, {
        body: JSON.stringify({ instruction: instruction.trim(), projectId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? `시작 실패 (${res.status})`);
      }
      const jobId: string = body.jobId;
      try {
        localStorage.setItem(jobKey(projectId), jobId);
      } catch {
        // ignore
      }
      subscribe(jobId);
    } catch (e) {
      setStatus("error");
      setEvents([
        {
          message: e instanceof Error ? e.message : "시작 실패",
          type: "error",
        },
      ]);
      toast.error(e instanceof Error ? e.message : "개발 시작 실패");
    }
  }, [instruction, status, projectId, subscribe]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex h-[45vh] flex-col border-border/60 border-t bg-background shadow-[0_-8px_24px_rgba(0,0,0,0.12)]">
      <div className="flex h-9 shrink-0 items-center gap-2 border-border/40 border-b px-3 text-[13px]">
        <TerminalIcon className="size-4" />
        <span className="font-medium">개발 콘솔</span>
        {status === "running" ? (
          <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
        ) : null}
        {status === "done" ? (
          <CircleCheckIcon className="size-3.5 text-emerald-500" />
        ) : null}
        {status === "error" ? (
          <CircleXIcon className="size-3.5 text-destructive" />
        ) : null}
        <button
          aria-label="닫기"
          className="ml-auto rounded-md p-1 hover:bg-muted"
          onClick={onClose}
          type="button"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap px-3 py-2 font-mono text-[12px] leading-[1.7]"
        ref={logRef}
      >
        {events.length === 0 ? (
          <span className="text-muted-foreground">
            지시사항을 입력하고 “개발 시작”을 누르세요.
          </span>
        ) : (
          events.map((e, i) => {
            const { text, tone } = lineFor(e);
            return (
              <div
                className={tone}
                // biome-ignore lint/suspicious/noArrayIndexKey: append-only log
                key={i}
              >
                {text}
              </div>
            );
          })
        )}
      </div>

      <div className="flex shrink-0 items-end gap-2 border-border/40 border-t p-2">
        <Textarea
          className="max-h-28 min-h-9 flex-1 text-[13px]"
          disabled={status === "running"}
          onChange={onInstructionChange}
          placeholder="예: 로그인 페이지에 비밀번호 표시 토글 추가하고 커밋"
          value={instruction}
        />
        <Button
          className={cn(status === "running" && "opacity-60")}
          disabled={status === "running" || !instruction.trim()}
          onClick={start}
        >
          {status === "running" ? "실행 중…" : "개발 시작"}
        </Button>
      </div>
    </div>
  );
}
