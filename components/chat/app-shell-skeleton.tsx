/**
 * Fallback for the app layout's <Suspense> boundary — shown while the server
 * resolves the session/cookies for the sidebar shell. Mimics the sidebar +
 * content split so the transition doesn't flash an empty coloured panel.
 */
export function AppShellSkeleton() {
  return (
    <div className="flex h-dvh w-full bg-sidebar">
      <div className="hidden w-64 shrink-0 flex-col gap-2 border-sidebar-border/60 border-r p-3 md:flex">
        <div className="h-8 w-full animate-pulse rounded-lg bg-sidebar-foreground/[0.06]" />
        <div className="mt-2 h-3 w-16 animate-pulse rounded bg-sidebar-foreground/[0.06]" />
        {[70, 55, 80, 45, 60, 50].map((w) => (
          <div
            className="h-7 animate-pulse rounded-md bg-sidebar-foreground/[0.05]"
            key={w}
            style={{ width: `${w}%` }}
          />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <div className="flex h-12 shrink-0 items-center gap-2 border-border/40 border-b px-4">
          <div className="h-5 w-28 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="flex-1" />
      </div>
    </div>
  );
}
