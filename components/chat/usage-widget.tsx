"use client";

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { type HeadroomLevel, headroomLevel } from "@/lib/ai/pricing";
import { cn, fetcher } from "@/lib/utils";

type ProviderKey = "anthropic" | "glm";

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
  series: { day: string; cost: number }[];
};

type UsageResponse = { providers: ProviderUsage[] };

const PROVIDER_LABEL: Record<ProviderKey, string> = {
  anthropic: "Claude",
  glm: "GLM",
};

const SERIES_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const LEVEL_BAR: Record<HeadroomLevel, string> = {
  danger: "bg-red-500",
  neutral: "bg-emerald-500/70",
  warn: "bg-amber-500",
};
const LEVEL_TEXT: Record<HeadroomLevel, string> = {
  danger: "text-red-500",
  neutral: "text-emerald-500",
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

/** Fill the series out to a fixed 14-day window ending today. */
function normalizeSeries(series: { day: string; cost: number }[]): number[] {
  const byDay = new Map(series.map((s) => [s.day, s.cost]));
  const start = Date.now();
  return Array.from({ length: SERIES_DAYS }, (_, idx) => {
    const key = new Date(start - (SERIES_DAYS - 1 - idx) * DAY_MS)
      .toISOString()
      .slice(0, 10);
    return byDay.get(key) ?? 0;
  });
}

function SparklineBar({
  value,
  max,
  level,
}: {
  value: number;
  max: number;
  level: HeadroomLevel;
}) {
  return (
    <div
      className={cn(
        "w-[3px] shrink-0 rounded-[1px]",
        value === 0 ? "bg-sidebar-foreground/15" : LEVEL_BAR[level]
      )}
      style={{
        height: value === 0 ? "2px" : `${Math.max(8, (value / max) * 100)}%`,
      }}
    />
  );
}

function Sparkline({
  values,
  level,
  className,
}: {
  values: number[];
  level: HeadroomLevel;
  className?: string;
}) {
  const max = Math.max(...values, 0.000_001);
  return (
    <div className={cn("flex items-end gap-[2px]", className)}>
      {values.map((v, i) => (
        <SparklineBar
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length daily buckets
          key={i}
          level={level}
          max={max}
          value={v}
        />
      ))}
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
  const values = useMemo(() => normalizeSeries(usage.series), [usage.series]);

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
      <div className="flex items-center gap-2">
        <span className="w-10 shrink-0 text-[11px] text-sidebar-foreground/60">
          {PROVIDER_LABEL[usage.provider]}
        </span>
        <Sparkline className="h-5 flex-1" level={level} values={values} />
        <span
          className={cn(
            "w-14 shrink-0 text-right text-[11px] tabular-nums",
            level === "neutral"
              ? "text-sidebar-foreground/70"
              : LEVEL_TEXT[level]
          )}
        >
          {formatUsd(usage.costUsd)}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-sidebar-border/60 p-2.5">
      <div className="flex items-center justify-between">
        <span className="font-medium text-[12px] text-sidebar-foreground">
          {PROVIDER_LABEL[usage.provider]}
        </span>
        <span className={cn("text-[13px] tabular-nums", LEVEL_TEXT[level])}>
          {formatUsd(usage.costUsd)}
        </span>
      </div>

      <Sparkline className="h-8" level={level} values={values} />

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

      <button
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-md border py-1 text-[11px] transition-colors",
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

      <div className="flex flex-col gap-1.5">
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
