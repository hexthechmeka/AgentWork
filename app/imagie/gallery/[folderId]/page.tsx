import { redirect } from "next/navigation";

type Props = { params: Promise<{ folderId: string }> };

export default async function ImagieFolderPage({ params }: Props) {
  const { folderId } = await params;
  redirect(`/imagie?gallery=${encodeURIComponent(folderId)}`);
}
