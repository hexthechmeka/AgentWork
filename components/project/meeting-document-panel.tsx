"use client";

import { CalendarIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const PLACEHOLDER_DOC = `# 구현계획서

아직 작성된 내용이 없습니다.

"미팅 시작"을 누르면 Claude와의 기획 대화를 바탕으로
이 문서의 초안이 여기에 채워질 예정입니다 (다음 단계에서 구현).
`;

export function MeetingDocumentPanel({ projectName }: { projectName: string }) {
  const [content, setContent] = useState(PLACEHOLDER_DOC);

  const handleStartMeeting = useCallback(() => {
    toast.info("미팅 세션은 다음 단계에서 구현됩니다.");
  }, []);

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setContent(e.target.value);
    },
    []
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-border/40 border-b px-4">
        <div className="flex min-w-0 flex-col">
          <span className="font-medium text-sm">미팅 문서</span>
          <span className="truncate text-[11px] text-muted-foreground">
            {projectName}
          </span>
        </div>
        <Button onClick={handleStartMeeting} size="sm" variant="outline">
          <CalendarIcon className="size-3.5" />
          미팅 시작
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <Textarea
          className="h-full min-h-full resize-none border-none bg-transparent font-mono text-sm shadow-none focus-visible:ring-0"
          onChange={handleContentChange}
          placeholder="구현계획서를 작성하세요..."
          value={content}
        />
      </div>
    </div>
  );
}
