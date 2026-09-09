"use client";

import { XIcon } from "lucide-react";
import { useEffect } from "react";
import { FolderImagesView } from "@/components/imagie/gallery/folder-images-view";
import { GalleryView } from "@/components/imagie/gallery/gallery-view";
import { closeGallery, useGalleryOverlay } from "@/lib/imagie/gallery-overlay";

// Gallery as an overlay over the generate screen — GenerateView stays
// mounted underneath, so its form state is never lost.
export function GalleryOverlay() {
  const { open, folderId } = useGalleryOverlay();

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeGallery();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <button
        aria-label="갤러리 닫기"
        className="absolute top-3 right-3 z-10 rounded-md bg-background/80 p-1.5 shadow hover:bg-muted"
        onClick={closeGallery}
        type="button"
      >
        <XIcon className="size-4" />
      </button>
      {folderId ? <FolderImagesView folderId={folderId} /> : <GalleryView />}
    </div>
  );
}
