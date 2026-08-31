export default function Loading() {
  return (
    <div className="flex h-dvh w-full flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center gap-2 border-border/40 border-b px-4">
        <div className="h-5 w-28 animate-pulse rounded-md bg-muted" />
        <div className="ml-auto h-5 w-20 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
        {["ml-auto w-1/2", "w-3/4", "ml-auto w-2/5", "w-4/5"].map((cls) => (
          <div
            className={`h-16 animate-pulse rounded-2xl bg-muted/70 ${cls}`}
            key={cls}
          />
        ))}
      </div>
      <div className="mx-auto mb-6 h-24 w-full max-w-4xl animate-pulse rounded-2xl bg-muted/60" />
    </div>
  );
}
