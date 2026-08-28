"use server";

import { generateText } from "ai";
import { auth } from "@/app/(auth)/auth";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { getLanguageModel } from "@/lib/ai/providers";
import { getChatById, getMessagesByChatId } from "@/lib/db/queries";
import { convertToUIMessages, getTextFromMessage } from "@/lib/utils";

const GLM_REVIEW_MODEL_ID = "glm/glm-5.3";
const ANNOTATED_MARKER = "===ANNOTATED===";
const EXPLANATION_MARKER = "===EXPLANATION===";

// Fast/cheap model for the live incremental note updates (runs once per
// chat turn while "미팅 진행중"). Deliberately not GLM: GLM-5.3's API
// concurrency limit is 1, which would make frequent background calls a
// bottleneck.
const NOTES_LIVE_MODEL_ID = "anthropic/claude-haiku-4-5-20251001";

async function requireChatOwnership(chatId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const chat = await getChatById({ id: chatId });
  if (!chat || chat.userId !== session.user.id) {
    throw new Error("Forbidden");
  }

  return session;
}

async function getChatTranscript(chatId: string) {
  const dbMessages = await getMessagesByChatId({ id: chatId });
  const uiMessages = convertToUIMessages(dbMessages);

  return uiMessages
    .map((msg) => {
      const text = getTextFromMessage(msg);
      if (!text.trim()) {
        return null;
      }
      return `${msg.role === "user" ? "사용자" : "Claude"}: ${text}`;
    })
    .filter((line): line is string => line !== null)
    .join("\n\n");
}

export async function generateMeetingNotes({ chatId }: { chatId: string }) {
  await requireChatOwnership(chatId);

  const transcript = await getChatTranscript(chatId);

  if (!transcript.trim()) {
    return "# 노트\n\n아직 기획 대화 내용이 없습니다. 먼저 좌측에서 대화를 나눠보세요.";
  }

  const { text } = await generateText({
    instructions:
      "너는 회의 노트 작성자야. 주어진 기획 대화를 자유 형식의 노트로 정리해. 마크다운 헤더/불릿을 적절히 써서 핵심 논의사항, 결정사항, 남은 질문을 정리해. 장황하게 쓰지 말고 핵심만 간결하게.",
    model: getLanguageModel(DEFAULT_CHAT_MODEL),
    prompt: transcript,
  });

  return text;
}

export async function updateMeetingNotesIncremental({
  previousNotes,
  userText,
  assistantText,
}: {
  previousNotes: string;
  userText: string;
  assistantText: string;
}) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const { text } = await generateText({
    instructions:
      "너는 실시간 회의 노트 작성자야. 기존 노트에 방금 오간 대화 한 턴만 반영해서 노트를 업데이트해. 전체를 다시 쓰지 말고 기존 구조와 이미 있는 내용은 최대한 유지한 채, 새로 나온 내용만 자연스러운 위치에 추가하거나 관련 있는 기존 항목을 수정해. 마크다운 형식을 유지해.",
    model: getLanguageModel(NOTES_LIVE_MODEL_ID),
    prompt: `## 기존 노트\n${previousNotes}\n\n## 방금 오간 대화\n사용자: ${userText}\nClaude: ${assistantText}`,
  });

  return text;
}

export async function generateSpecFromNotes({
  chatId,
  notes,
  modelId,
}: {
  chatId: string;
  notes: string;
  modelId: string;
}) {
  await requireChatOwnership(chatId);

  const transcript = await getChatTranscript(chatId);

  const { text } = await generateText({
    instructions:
      "너는 소프트웨어 구현계획서 작성자야. 주어진 노트와 기획 대화 원문을 바탕으로 정식 구현계획서를 마크다운으로 작성해. 목표, 범위, 주요 기능, 데이터 모델/API 변경, 일정/우선순위, 리스크 섹션을 포함해.",
    model: getLanguageModel(modelId),
    prompt: `## 노트\n${notes}\n\n## 기획 대화 원문\n${transcript}`,
  });

  return text;
}

// Matches the [[GLM: ...]] marker the model is instructed to use. We wrap
// matches in real markdown code-span syntax ourselves (rather than trusting
// the model to emit backticks literally) so the red-annotation styling in
// MeetingDocumentPanel's preview mode reliably applies regardless of how
// faithfully the model followed the formatting instruction.
const ANNOTATION_MARKER_PATTERN = /\[\[GLM:\s*([^\]]*)\]\]/g;

function styleAnnotations(text: string): string {
  return text.replace(
    ANNOTATION_MARKER_PATTERN,
    (_match, comment: string) => `\`⚠ GLM: ${comment.trim()}\``
  );
}

export async function reviewSpecWithGlm({
  chatId,
  spec,
}: {
  chatId: string;
  spec: string;
}) {
  await requireChatOwnership(chatId);

  const { text } = await generateText({
    instructions: `너는 시니어 엔지니어로서 구현계획서를 검토해. 구현 불가능하거나 난이도가 높은 부분, 반드시 짚어야 할 리스크가 있는 지점에만, 원문 중간에 [[GLM: 코멘트]] 형태의 마커를 삽입해 (대괄호 두 개로 감싸는 형식을 정확히 지켜). 첨언은 꼭 필요한 곳에만 최소한으로 넣고, 원문 나머지는 그대로 유지해.

반드시 아래 형식으로만 응답해:
${ANNOTATED_MARKER}
(마커가 삽입된 전체 구현계획서 원문)
${EXPLANATION_MARKER}
(위 첨언들에 대한 자세한 해설, 채팅 메시지 형태로)`,
    model: getLanguageModel(GLM_REVIEW_MODEL_ID),
    prompt: spec,
  });

  const annotatedIndex = text.indexOf(ANNOTATED_MARKER);
  const explanationIndex = text.indexOf(EXPLANATION_MARKER);

  if (annotatedIndex === -1 || explanationIndex === -1) {
    return { annotatedSpec: styleAnnotations(spec), explanation: text.trim() };
  }

  const annotatedSpec = text
    .slice(annotatedIndex + ANNOTATED_MARKER.length, explanationIndex)
    .trim();
  const explanation = text
    .slice(explanationIndex + EXPLANATION_MARKER.length)
    .trim();

  return {
    annotatedSpec: styleAnnotations(annotatedSpec || spec),
    explanation,
  };
}
