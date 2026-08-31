"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { Persona } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

function setChatModelCookie(model: string) {
  try {
    // biome-ignore lint/suspicious/noDocumentCookie: matches the app's setCookie pattern
    document.cookie = `chat-model=${encodeURIComponent(model)}; path=/; max-age=31536000`;
  } catch {
    // ignore
  }
}

function PersonaCard({
  persona,
  onStart,
  starting,
}: {
  persona: Persona;
  onStart: (persona: Persona) => void;
  starting: boolean;
}) {
  const handleStart = useCallback(() => {
    onStart(persona);
  }, [onStart, persona]);

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card/40 transition-colors hover:border-border hover:bg-card">
      <button
        className="flex flex-1 flex-col items-center gap-3 p-4 text-center disabled:opacity-60"
        disabled={starting}
        onClick={handleStart}
        type="button"
      >
        <span className="flex size-16 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-[11px] text-muted-foreground">
          {persona.avatarUrl ? (
            // biome-ignore lint/performance/noImgElement: user-uploaded blob avatar
            <img
              alt=""
              className="size-full object-cover"
              src={persona.avatarUrl}
            />
          ) : (
            persona.name.slice(0, 2)
          )}
        </span>
        <span className="font-medium text-[14px] text-foreground">
          {persona.name}
        </span>
        {persona.tagline ? (
          <span className="line-clamp-2 text-[12px] text-muted-foreground">
            {persona.tagline}
          </span>
        ) : null}
      </button>
      <Link
        className="absolute top-2 right-2 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
        href={`/aichat/${persona.id}/edit`}
      >
        <PencilIcon className="size-3.5" />
      </Link>
    </div>
  );
}

export function PersonaGallery({ personas }: { personas: Persona[] }) {
  const router = useRouter();
  const [startingId, setStartingId] = useState<string | null>(null);

  const handleStart = useCallback(
    async (persona: Persona) => {
      setStartingId(persona.id);
      try {
        setChatModelCookie(persona.defaultModel);
        const res = await fetch(`/api/personas/${persona.id}/start`, {
          method: "POST",
        });
        if (!res.ok) {
          throw new Error("start failed");
        }
        const { chatId } = await res.json();
        router.push(`/chat/${chatId}`);
      } catch {
        toast.error("대화를 시작하지 못했습니다");
        setStartingId(null);
      }
    },
    [router]
  );

  return (
    <div className="h-dvh w-full overflow-y-auto bg-background">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-foreground text-xl tracking-tight">
              AIchat
            </h1>
            <p className="text-[13px] text-muted-foreground">
              캐릭터 {personas.length}개
            </p>
          </div>
          <Link
            className={cn(
              "flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 font-medium text-[13px] text-background transition-opacity hover:opacity-90"
            )}
            href="/aichat/new"
          >
            <PlusIcon className="size-4" />새 캐릭터
          </Link>
        </header>

        {personas.length === 0 ? (
          <div className="rounded-xl border border-border/50 border-dashed px-4 py-12 text-center text-[13px] text-muted-foreground">
            아직 캐릭터가 없습니다. “새 캐릭터”로 만들어보세요.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {personas.map((persona) => (
              <PersonaCard
                key={persona.id}
                onStart={handleStart}
                persona={persona}
                starting={startingId === persona.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
