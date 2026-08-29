export default function Loading() {
  return (
    <div className="flex h-dvh w-full flex-col bg-background">
      {/* project header bar */}
      <div className="flex h-11 shrink-0 items-center gap-3 border-border/40 border-b bg-sidebar px-3">
        <div className="h-5 w-40 animate-pulse rounded-md bg-muted" />
        <div className="ml-auto h-5 w-24 animate-pulse rounded-md bg-muted" />
      </div>

      {/* overview body skeleton */}
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="h-7 w-56 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-28 animate-pulse rounded bg-muted/70" />
          </div>
          <div className="h-9 w-24 animate-pulse rounded-lg bg-muted" />
        </div>

        <div className="flex flex-col gap-2">
          <div className="h-3 w-16 animate-pulse rounded bg-muted/60" />
          {["a", "b", "c", "d"].map((k) => (
            <div
              className="h-[52px] animate-pulse rounded-lg border border-border/50 bg-card/40"
              key={k}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
