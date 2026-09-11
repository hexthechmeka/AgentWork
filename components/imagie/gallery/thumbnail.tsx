import { cn } from "@/lib/utils";

// Shared by the folder-card grid (gallery-view.tsx) and the image grid
// inside an opened folder (folder-images-view.tsx) so incognito/secret mode
// blurs both consistently — no exceptions for 미분류/custom/임시 folders.
export function GalleryThumbnail({
  src,
  incognito,
  className,
}: {
  src: string | null;
  incognito: boolean;
  className?: string;
}) {
  if (!src) {
    return null;
  }
  return (
    // biome-ignore lint/performance/noImgElement: blob thumb
    <img
      alt=""
      className={cn(
        "size-full object-cover",
        incognito && "blur-xl",
        className
      )}
      draggable={false}
      src={src}
    />
  );
}
