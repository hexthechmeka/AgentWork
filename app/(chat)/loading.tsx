export default function Loading() {
  return (
    <div className="flex h-dvh w-full flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center gap-2 border-border/40 border-b px-4">
        <div className="h-5 w-28 animate-pulse rounded-md bg-muted" />
        <div className="ml-auto h-5 w-20 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-4">
        <div className="h-8 w-2/3 animate-pulse self-center rounded-md bg-muted" />
        <div className="h-4 w-1/2 animate-pulse self-center rounded bg-muted/70" />
      </div>
      <div className="mx-auto mb-6 h-24 w-full max-w-4xl animate-pulse rounded-2xl bg-muted/60" />
    </div>
  );
}
