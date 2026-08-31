"use client";

import { formatDistanceToNow } from "date-fns";
import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { type HeadroomLevel, headroomLevel } from "@/lib/ai/pricing";
import { cn, fetcher } from "@/lib/utils";

type ProviderKey = "anthropic" | "glm" | "aichat";

type ProviderUsage = {
  provider: ProviderKey;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  softLimitUsd: number | null;
  hardLimitUsd: number | null;
  softExceeded: boolean;
  hardLocked: boolean;
  periodStart: string;
};

type UsageResponse = { providers: ProviderUsage[] };

const PROVIDER_LABEL: Record<ProviderKey, string> = {
  aichat: "AIchat",
  anthropic: "Claude",
  glm: "GLM",
};

const LEVEL_FILL: Record<HeadroomLevel, string> = {
  danger: "bg-red-500",
  neutral: "bg-emerald-500/80",
  warn: "bg-amber-500",
};
const LEVEL_TEXT: Record<HeadroomLevel, string> = {
  danger: "text-red-500",
  neutral: "text-sidebar-foreground/70",
  warn: "text-amber-500",
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}K`;
  }
  return String(n);
}

function formatUsd(n: number): string {
  if (n === 0) {
    return "$0";
  }
  if (n < 1) {
    return `$${n.toFixed(4)}`;
  }
  if (n < 100) {
    return `$${n.toFixed(2)}`;
  }
  return `$${n.toFixed(0)}`;
}

/** Percent of the (hard, else soft) limit consumed this period. null = no limit. */
function usedPercent(usage: ProviderUsage): number | null {
  const denom = usage.hardLimitUsd ?? usage.softLimitUsd;
  if (!denom || denom <= 0) {
    return null;
  }
  return Math.min(100, (usage.costUsd / denom) * 100);
}

function MeterBar({
  percent,
  level,
  className,
}: {
  percent: number | null;
  level: HeadroomLevel;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-full bg-sidebar-foreground/10",
        className
      )}
    >
      <div
        className={cn("h-full rounded-full transition-all", LEVEL_FILL[level])}
        style={{
          width: percent === null ? "0%" : `${Math.max(percent, 1.5)}%`,
        }}
      />
    </div>
  );
}

function LimitField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number | null;
  onCommit: (v: number | null) => void;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));

  useEffect(() => {
    setDraft(value === null ? "" : String(value));
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDraft(e.target.value);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.currentTarget.blur();
      }
    },
    []
  );

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed === "") {
      onCommit(null);
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) && parsed >= 0) {
      onCommit(parsed);
    }
  }, [draft, onCommit]);

  return (
    <label className="flex items-center justify-between gap-2 text-[12px]">
      <span className="text-sidebar-foreground/60">{label}</span>
      <span className="flex items-center gap-1">
        <span className="text-sidebar-foreground/40">$</span>
        <input
          className="w-16 rounded border border-sidebar-border bg-transparent px-1.5 py-0.5 text-right text-[12px] text-sidebar-foreground outline-none focus:border-sidebar-foreground/40"
          inputMode="decimal"
          onBlur={commit}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="없음"
          value={draft}
        />
      </span>
    </label>
  );
}

function ProviderRow({
  usage,
  expanded,
  onSaveLimits,
  onReset,
}: {
  usage: ProviderUsage;
  expanded: boolean;
  onSaveLimits: (
    provider: ProviderKey,
    soft: number | null,
    hard: number | null
  ) => void;
  onReset: (provider: ProviderKey) => void;
}) {
  const level = headroomLevel(usage.costUsd, usage.hardLimitUsd);
  const percent = usedPercent(usage);

  const handleSoftCommit = useCallback(
    (v: number | null) => {
      onSaveLimits(usage.provider, v, usage.hardLimitUsd);
    },
    [onSaveLimits, usage.provider, usage.hardLimitUsd]
  );
  const handleHardCommit = useCallback(
    (v: number | null) => {
      onSaveLimits(usage.provider, usage.softLimitUsd, v);
    },
    [onSaveLimits, usage.provider, usage.softLimitUsd]
  );
  const handleReset = useCallback(() => {
    onReset(usage.provider);
  }, [onReset, usage.provider]);

  if (!expanded) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-sidebar-foreground/60">
            {PROVIDER_LABEL[usage.provider]}
          </span>
          <span className={cn("tabular-nums", LEVEL_TEXT[level])}>
            {percent === null
              ? formatUsd(usage.costUsd)
              : `${Math.round(percent)}%`}
          </span>
        </div>
        <MeterBar className="h-1.5" level={level} percent={percent} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-sidebar-border/60 p-2.5">
      <div className="flex items-center justify-between">
        <span className="font-medium text-[12px] text-sidebar-foreground">
          {PROVIDER_LABEL[usage.provider]}
        </span>
        <span className="text-[13px] text-sidebar-foreground tabular-nums">
          {formatUsd(usage.costUsd)}
          {usage.hardLimitUsd ? ` / ${formatUsd(usage.hardLimitUsd)}` : ""}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <MeterBar className="h-2 flex-1" level={level} percent={percent} />
        <span
          className={cn(
            "w-8 shrink-0 text-right text-[11px] tabular-nums",
            LEVEL_TEXT[level]
          )}
        >
          {percent === null ? "—" : `${Math.round(percent)}%`}
        </span>
      </div>

      <div className="flex justify-between text-[11px] text-sidebar-foreground/60 tabular-nums">
        <span>in {formatTokens(usage.inputTokens)}</span>
        <span>out {formatTokens(usage.outputTokens)}</span>
      </div>

      <div className="flex flex-col gap-1 border-sidebar-border/50 border-t pt-2">
        <LimitField
          label="Soft 한도"
          onCommit={handleSoftCommit}
          value={usage.softLimitUsd}
        />
        <LimitField
          label="Hard 한도"
          onCommit={handleHardCommit}
          value={usage.hardLimitUsd}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-sidebar-foreground/40">
          {formatDistanceToNow(new Date(usage.periodStart), {
            addSuffix: true,
          })}{" "}
          리셋됨
        </span>
        <button
          className={cn(
            "flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors",
            usage.hardLocked
              ? "border-red-500/40 bg-red-500/10 text-red-500 hover:bg-red-500/20"
              : "border-sidebar-border text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          )}
          onClick={handleReset}
          type="button"
        >
          <RotateCcwIcon className="size-3" />
          한도 리셋
        </button>
      </div>
    </div>
  );
}

export function UsageWidget() {
  const { data, mutate } = useSWR<UsageResponse>("/api/usage", fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });

  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    try {
      setExpanded(localStorage.getItem("usage-widget-expanded") === "1");
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("usage-widget-expanded", next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const providers = data?.providers ?? [];

  const saveLimits = useCallback(
    async (provider: ProviderKey, soft: number | null, hard: number | null) => {
      await mutate(
        (cur) =>
          cur && {
            providers: cur.providers.map((p) =>
              p.provider === provider
                ? { ...p, hardLimitUsd: hard, softLimitUsd: soft }
                : p
            ),
          },
        { revalidate: false }
      );
      await fetch("/api/usage/limits", {
        body: JSON.stringify({
          hardLimitUsd: hard,
          provider,
          softLimitUsd: soft,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      mutate();
    },
    [mutate]
  );

  const resetProvider = useCallback(
    async (provider: ProviderKey) => {
      await fetch("/api/usage/reset", {
        body: JSON.stringify({ provider }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      mutate();
    },
    [mutate]
  );

  const softAlerts = providers.filter((p) => p.softExceeded);

  return (
    <div className="flex flex-col gap-1.5 px-1 pb-1 group-data-[collapsible=icon]:hidden">
      {softAlerts.length > 0 ? (
        <div className="flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-600 dark:text-amber-400">
          <TriangleAlertIcon className="mt-px size-3 shrink-0" />
          <span>
            {softAlerts.map((p) => PROVIDER_LABEL[p.provider]).join(", ")} soft
            한도 초과 — 사용은 계속 가능합니다.
          </span>
        </div>
      ) : null}

      <button
        className="flex items-center justify-between rounded-md px-1.5 py-1 text-[11px] text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent/40 hover:text-sidebar-foreground/80"
        onClick={toggle}
        type="button"
      >
        <span className="font-medium uppercase tracking-[0.1em]">사용량</span>
        <span>{expanded ? "접기" : "펼치기"}</span>
      </button>

      <div className="flex flex-col gap-2">
        {providers.length === 0 ? (
          <div className="px-1.5 py-1 text-[11px] text-sidebar-foreground/40">
            불러오는 중…
          </div>
        ) : (
          providers.map((p) => (
            <ProviderRow
              expanded={expanded}
              key={p.provider}
              onReset={resetProvider}
              onSaveLimits={saveLimits}
              usage={p}
            />
          ))
        )}
      </div>
    </div>
  );
}
