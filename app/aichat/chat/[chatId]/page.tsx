import { AichatChatPane } from "@/components/aichat/aichat-chat-pane";

// The chat id is read from the pathname by useActiveChat; this page just
// mounts the pane. Ownership/visibility is enforced by /api/messages.
export default function AichatChatPage() {
  return <AichatChatPane />;
}
