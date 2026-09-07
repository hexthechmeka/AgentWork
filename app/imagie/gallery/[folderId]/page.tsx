import { FolderImagesView } from "@/components/imagie/gallery/folder-images-view";

type Props = { params: Promise<{ folderId: string }> };

export default async function ImagieFolderPage({ params }: Props) {
  const { folderId } = await params;
  return <FolderImagesView folderId={folderId} />;
}
