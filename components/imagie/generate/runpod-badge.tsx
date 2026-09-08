"use client";

import { Loader2Icon, PlayIcon, SquareIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  fetchRunpodStatus,
  type RunpodStatus,
  startRunpod,
  stopRunpod,
} from "@/lib/imagie/runpod-control";
import { cn } from "@/lib/utils";

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

type Bump = { current: number };

/**
 * Top-bar power control (spec §4.4). Polls `/api/imagie/runpod/status`:
 * off → "시작", booting → spinner + mm:ss + phase text, on → green "중지".
 * The `bump` ref lets the Generate flow force an immediate re-poll.
 */
export function RunpodBadge({
  bump,
  onReady,
}: {
  bump?: Bump;
  /** Fired when the pod's image API goes reachable (rising edge). */
  onReady?: () => void;
}) {
  const [status, setStatus] = useState<RunpodStatus | null>(null);
  const [busy, setBusy] = useState<null | "start" | "stop">(null);
  const [bootStart, setBootStart] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const lastBump = useRef(0);
  const wasReady = useRef(false);

  const poll = useCallback(async () => {
    try {
      setStatus(await fetchRunpodStatus());
    } catch {
      // keep last known
    }
  }, []);

  useEffect(() => {
    poll();
    const alive = status?.alive;
    const interval = alive ? 10_000 : 5000;
    const id = setInterval(poll, interval);
    return () => clearInterval(id);
  }, [poll, status?.alive]);

  // Let the parent trigger an out-of-band refresh.
  useEffect(() => {
    if (bump && bump.current !== lastBump.current) {
      lastBump.current = bump.current;
      poll();
    }
  });

  // 1s clock while booting.
  useEffect(() => {
    if (bootStart === null) {
      return;
    }
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [bootStart]);

  useEffect(() => {
    if (status?.generateReady || status?.desiredStatus === "EXITED") {
      setBootStart(null);
    }
  }, [status?.generateReady, status?.desiredStatus]);

  // Rising edge of generateReady → tell the parent to refresh (model list).
  useEffect(() => {
    const ready = Boolean(status?.generateReady);
    if (ready && !wasReady.current) {
      onReady?.();
    }
    wasReady.current = ready;
  }, [status?.generateReady, onReady]);

  const onStart = useCallback(async () => {
    setBusy("start");
    setBootStart(Date.now());
    try {
      await startRunpod();
      await poll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "시작 실패");
      setBootStart(null);
    } finally {
      setBusy(null);
    }
  }, [poll]);

  const onStop = useCallback(async () => {
    setBusy("stop");
    try {
      await stopRunpod();
      await poll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "중지 실패");
    } finally {
      setBusy(null);
    }
  }, [poll]);

  if (!status) {
    return (
      <span className="text-[12px] text-muted-foreground">
        Pod 상태 확인 중…
      </span>
    );
  }

  if (!status.configured) {
    return (
      <span className="text-[12px] text-muted-foreground">
        Pod 미설정 —{" "}
        <a className="underline" href="/imagie/settings">
          설정
        </a>
      </span>
    );
  }

  const { generateReady: ready, alive } = status;
  const booting = !ready && (bootStart !== null || alive);
  const elapsed = bootStart ? Date.now() - bootStart : 0;

  let phaseText = "Pod 시작 요청 중";
  if (alive && !ready) {
    phaseText = "백엔드 응답 대기 중";
  } else if (bootStart && !alive) {
    phaseText = "Pod 부팅 중";
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "size-2 rounded-full",
          ready
            ? "bg-emerald-500"
            : booting
              ? "bg-amber-500"
              : "bg-muted-foreground/40"
        )}
      />
      {booting ? (
        <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Loader2Icon className="size-3.5 animate-spin" />
          {phaseText}
          <span className="tabular-nums">{fmt(elapsed)}</span>
          {elapsed > 5 * 60_000 ? (
            <span className="text-amber-600">
              · 예상보다 오래 걸리고 있어요
            </span>
          ) : (
            <span className="text-muted-foreground/60">· 보통 1~3분</span>
          )}
        </span>
      ) : (
        <span className="text-[12px] text-muted-foreground">
          {ready ? "실행 중" : "꺼짐"}
        </span>
      )}

      {ready ? (
        <Button
          className="h-7 px-2 text-[12px]"
          disabled={busy !== null || !alive}
          onClick={onStop}
          size="sm"
          variant="outline"
        >
          <SquareIcon className="size-3" />
          중지
        </Button>
      ) : (
        <Button
          className="h-7 px-2 text-[12px]"
          disabled={busy !== null || !status.hasRunpodKey}
          onClick={onStart}
          size="sm"
          variant="outline"
        >
          {busy === "start" ? (
            <Loader2Icon className="size-3 animate-spin" />
          ) : (
            <PlayIcon className="size-3" />
          )}
          시작
        </Button>
      )}
    </div>
  );
}
