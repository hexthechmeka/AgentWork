import { notFound, redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { ProjectView } from "@/components/project/project-view";
import { getProjectWithChatsById } from "@/lib/db/queries";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
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

  // The active chat (and whether we show the overview vs. the workspace) is
  // driven entirely by the `?chat=` query param, read client-side in
  // ProjectView. That keeps switching between chats inside an open project a
  // pure client transition — no server round-trip, no remount.
  return (
    <ProjectView
      chats={project.chats}
      projectId={project.id}
      projectName={project.name}
    />
  );
}
