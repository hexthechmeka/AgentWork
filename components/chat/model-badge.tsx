import { cn } from "@/lib/utils";

export type ModelProvider = "anthropic" | "glm";

export function providerFromModelId(modelId?: string | null): ModelProvider {
  return modelId?.startsWith("glm/") ? "glm" : "anthropic";
}

const PROVIDER_META: Record<
  ModelProvider,
  { label: string; letter: string; bg: string }
> = {
  anthropic: { bg: "#D97757", label: "Claude", letter: "C" },
  glm: { bg: "#06B6D4", label: "GLM", letter: "G" },
};

export function ModelAvatar({
  provider,
  className,
}: {
  provider: ModelProvider;
  className?: string;
}) {
  const meta = PROVIDER_META[provider];
  return (
    <div
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg text-[12px] font-semibold text-white ring-1 ring-border/50",
        className
      )}
      style={{ backgroundColor: meta.bg }}
    >
      {meta.letter}
    </div>
  );
}

export function ModelNameLabel({
  provider,
  className,
}: {
  provider: ModelProvider;
  className?: string;
}) {
  const meta = PROVIDER_META[provider];
  return (
    <span
      className={cn("font-medium text-[11px] text-muted-foreground", className)}
    >
      {meta.label}
    </span>
  );
}
