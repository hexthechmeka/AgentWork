import { cn } from "@/lib/utils";

// Reusable "this is not fully baked" marker. Extend `STYLES` as new states
// are needed (spec §10). First use: the `safety_check` toggle.
export type FeatureBadgeType = "experimental" | "beta" | "deprecated";

const STYLES: Record<FeatureBadgeType, string> = {
  beta: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
  deprecated: "bg-muted text-muted-foreground line-through",
  experimental: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
};

const LABELS: Record<FeatureBadgeType, string> = {
  beta: "beta",
  deprecated: "deprecated",
  experimental: "experimental",
};

export function FeatureBadge({
  type,
  className,
}: {
  type: FeatureBadgeType;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 font-medium text-[10px] uppercase tracking-wide",
        STYLES[type],
        className
      )}
    >
      {LABELS[type]}
    </span>
  );
}
