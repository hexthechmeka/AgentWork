"use client";

import { useEffect } from "react";
import { openGallery } from "@/lib/imagie/gallery-overlay";

// `/imagie/gallery` and `/imagie/gallery/[folderId]` redirect to
// `/imagie?gallery=…`; this reads that param once and opens the overlay,
// then strips it from the URL.
export function ImagieGalleryDeepLink() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const g = params.get("gallery");
    if (g === null) {
      return;
    }
    openGallery(g === "1" || g === "" ? null : g);
    params.delete("gallery");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (qs ? `?${qs}` : "")
    );
  }, []);
  return null;
}
