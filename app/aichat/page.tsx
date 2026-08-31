import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { PersonaCard } from "@/components/aichat/persona-card";
import { getPersonasByOwnerId } from "@/lib/db/queries";

export default async function AichatHome() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const personas = await getPersonasByOwnerId({ ownerId: session.user.id });

  return (
    <div className="h-dvh w-full overflow-y-auto bg-background">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-foreground text-xl tracking-tight">
              캐릭터
            </h1>
            <p className="text-[13px] text-muted-foreground">
              {personas.length}개
            </p>
          </div>
          <Link
            className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 font-medium text-[13px] text-background transition-opacity hover:opacity-90"
            href="/aichat/new"
          >
            <PlusIcon className="size-4" />새 캐릭터
          </Link>
        </header>

        {personas.length === 0 ? (
          <div className="rounded-xl border border-border/50 border-dashed px-4 py-16 text-center text-[13px] text-muted-foreground">
            아직 캐릭터가 없습니다. “새 캐릭터”로 만들어보세요.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {personas.map((persona) => (
              <PersonaCard key={persona.id} persona={persona} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
