import { ImagieGalleryDeepLink } from "@/components/imagie/gallery/gallery-deep-link";
import { GalleryOverlay } from "@/components/imagie/gallery/gallery-overlay";
import { GenerateView } from "@/components/imagie/generate/generate-view";

// Auth is enforced in app/imagie/layout.tsx. The gallery opens as an overlay
// over GenerateView (see gallery-overlay) so form state survives navigation.
export default function ImagiePage() {
  return (
    <>
      <GenerateView />
      <GalleryOverlay />
      <ImagieGalleryDeepLink />
    </>
  );
}
