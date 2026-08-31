import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { getPersonasByOwnerId } from "@/lib/db/queries";
import { PersonaGallery } from "./persona-gallery";

export default async function AichatPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const personas = await getPersonasByOwnerId({ ownerId: session.user.id });
  return <PersonaGallery personas={personas} />;
}
