import { notFound, redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { ProjectView } from "@/components/project/project-view";
import { getProjectWithChatsById } from "@/lib/db/queries";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ chat?: string }>;
}) {
  const { projectId } = await params;
  const { chat: chatIdParam } = await searchParams;
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const project = await getProjectWithChatsById({
    id: projectId,
    userId: session.user.id,
  });

  if (!project) {
    notFound();
  }

  const planningChats = project.chats.filter((c) => c.kind !== "unified");
  const requestedChat =
    chatIdParam && chatIdParam !== "new"
      ? planningChats.find((c) => c.id === chatIdParam)
      : undefined;
  const existingChatId =
    chatIdParam === "new"
      ? undefined
      : (requestedChat?.id ?? planningChats.at(0)?.id);
  const unifiedChatId = project.chats.find((c) => c.kind === "unified")?.id;

  return (
    <ProjectView
      existingChatId={existingChatId}
      projectId={project.id}
      projectName={project.name}
      unifiedChatId={unifiedChatId}
    />
  );
}
