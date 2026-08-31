import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { EMPTY_PERSONA, PersonaForm } from "../persona-form";

export default async function NewPersonaPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return (
    <div className="h-dvh w-full overflow-y-auto bg-background">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-6 font-semibold text-foreground text-xl tracking-tight">
          새 캐릭터
        </h1>
        <PersonaForm initial={EMPTY_PERSONA} />
      </div>
    </div>
  );
}
