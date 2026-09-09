import { redirect } from "next/navigation";

// The gallery is an overlay on /imagie now (keeps GenerateView mounted).
// Any direct hit / bookmark to this route reopens it there.
export default function ImagieGalleryPage() {
  redirect("/imagie?gallery=1");
}
