import Link from "next/link";
import type { Persona } from "@/lib/db/schema";

export function PersonaCard({ persona }: { persona: Persona }) {
  const image = persona.panelImageUrl ?? persona.avatarUrl;
  return (
    <Link
      className="group flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card/40 transition-colors hover:border-border hover:bg-card"
      href={`/aichat/${persona.id}`}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
        {image ? (
          // biome-ignore lint/performance/noImgElement: user-uploaded blob image
          <img
            alt=""
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            src={image}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-2xl text-muted-foreground/40">
            {persona.name.slice(0, 2)}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
          <p className="truncate font-semibold text-[14px] text-white">
            {persona.name}
          </p>
          {persona.tagline ? (
            <p className="line-clamp-1 text-[11px] text-white/70">
              {persona.tagline}
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
