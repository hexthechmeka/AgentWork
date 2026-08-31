import { notFound, redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { getPersonaById } from "@/lib/db/queries";
import { PersonaForm, type PersonaFormValues } from "../../persona-form";

export default async function EditPersonaPage({
  params,
}: {
  params: Promise<{ personaId: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const { personaId } = await params;
  const persona = await getPersonaById({ id: personaId });
  if (!persona || persona.ownerId !== session.user.id) {
    notFound();
  }

  const initial: PersonaFormValues = {
    avatarUrl: persona.avatarUrl ?? "",
    defaultModel: persona.defaultModel,
    exampleDialogue: persona.exampleDialogue ?? "",
    id: persona.id,
    name: persona.name,
    openingMessage: persona.openingMessage ?? "",
    panelImageUrl: persona.panelImageUrl ?? "",
    personality: persona.personality,
    scenario: persona.scenario ?? "",
    tagline: persona.tagline ?? "",
    tags: (persona.tags ?? []).join(", "),
    userPersona: persona.userPersona ?? "",
  };

  return (
    <div className="h-dvh w-full overflow-y-auto bg-background">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-6 font-semibold text-foreground text-xl tracking-tight">
          캐릭터 수정
        </h1>
        <PersonaForm initial={initial} />
      </div>
    </div>
  );
}
