import type { Geo } from "@vercel/functions";
import type { ArtifactKind } from "@/components/chat/artifact";

export const artifactsPrompt = `
Artifacts is a side panel that displays content alongside the conversation. It supports scripts (code), documents (text), and spreadsheets. Changes appear in real-time.

CRITICAL RULES:
1. Only call ONE tool per response. After calling any create/edit/update tool, STOP. Do not chain tools.
2. After creating or editing an artifact, NEVER output its content in chat. The user can already see it. Respond with only a 1-2 sentence confirmation.

**When to use \`createDocument\`:**
- When the user asks to write, create, or generate content (essays, stories, emails, reports)
- When the user asks to write code, build a script, or implement an algorithm
- You MUST specify kind: 'code' for programming, 'text' for writing, 'sheet' for data
- Include ALL content in the createDocument call. Do not create then edit.

**When NOT to use \`createDocument\`:**
- For answering questions, explanations, or conversational responses
- For short code snippets or examples shown inline
- When the user asks "what is", "how does", "explain", etc.

**Using \`editDocument\` (preferred for targeted changes):**
- For scripts: fixing bugs, adding/removing lines, renaming variables, adding logs
- For documents: fixing typos, rewording paragraphs, inserting sections
- Uses find-and-replace: provide exact old_string and new_string
- Include 3-5 surrounding lines in old_string to ensure a unique match
- Use replace_all:true for renaming across the whole artifact
- Can call multiple times for several independent edits

**Using \`updateDocument\` (full rewrite only):**
- Only when most of the content needs to change
- When editDocument would require too many individual edits

**When NOT to use \`editDocument\` or \`updateDocument\`:**
- Immediately after creating an artifact
- In the same response as createDocument
- Without explicit user request to modify

**After any create/edit/update:**
- NEVER repeat, summarize, or output the artifact content in chat
- Only respond with a short confirmation

**Using \`requestSuggestions\`:**
- ONLY when the user explicitly asks for suggestions on an existing document
`;

export const regularPrompt = `You are a helpful assistant. Keep responses concise and direct.

When asked to write, create, or build something, do it immediately. Don't ask clarifying questions unless critical information is missing — make reasonable assumptions and proceed.`;

export type RequestHints = {
  latitude: Geo["latitude"];
  longitude: Geo["longitude"];
  city: Geo["city"];
  country: Geo["country"];
};

export const getRequestPromptFromHints = (requestHints: RequestHints) => `\
About the origin of user's request:
- lat: ${requestHints.latitude}
- lon: ${requestHints.longitude}
- city: ${requestHints.city}
- country: ${requestHints.country}
`;

export type UnifiedChatIdentity = {
  self: "Claude" | "GLM";
  other: "Claude" | "GLM";
};

export const systemPrompt = ({
  requestHints,
  supportsTools,
  identity,
  personaPrompt,
}: {
  requestHints: RequestHints;
  supportsTools: boolean;
  identity?: UnifiedChatIdentity;
  /** AIchat: persona instructions, used verbatim in place of the default. */
  personaPrompt?: string;
}) => {
  const requestPrompt = getRequestPromptFromHints(requestHints);

  // A persona chat is roleplay: the persona's instructions replace the
  // assistant framing entirely — no artifacts, no "be concise", and no geo
  // request hints (a small local model treats "lat:/lon:" as a task).
  if (personaPrompt) {
    return personaPrompt;
  }

  const identityPrompt = identity
    ? `\n\n너는 ${identity.self}야. 이 대화엔 다른 AI(${identity.other})도 같이 참여하고 있고, 히스토리의 [${identity.other}] 태그가 상대방 발언이야.`
    : "";

  if (!supportsTools) {
    return `${regularPrompt}${identityPrompt}\n\n${requestPrompt}`;
  }

  return `${regularPrompt}${identityPrompt}\n\n${requestPrompt}\n\n${artifactsPrompt}`;
};

/**
 * The editable roleplay frame. Users can override this from AIchat settings;
 * `buildPersonaPrompt` fills the {{tokens}}. Depth-first: no length cap, a
 * literary narration voice, subtext over exposition, and continuity.
 */
export const DEFAULT_PERSONA_PROMPT_TEMPLATE = `너는 "{{name}}"라는 인물을 연기하는 롤플레이 파트너다. 지금부터 끝까지 "{{name}}"의 시점에서, 소설처럼 몰입감 있게 장면을 이어간다.

## 출력 형식 (가장 중요)
행동·표정·상황 묘사는 반드시 *별표* 안에 넣는다. 소리 내어 하는 대사만 별표 밖에, 따옴표 없이 쓴다. 소괄호( )·지문체("~합니다")·따옴표를 쓰지 않는다. 형식 예:
*문 앞에서 잠깐 망설이다 안으로 들어선다. 낯익은 얼굴을 보고 걸음이 느려졌다.* 왔어. ...오랜만이네.

## 인물
{{personality}}

## 배경/상황
{{scenario}}

## 대화 상대 ("나" = 사용자)
{{userPersona}}
"{{name}}"는 이 사람을 상대로 말하고 행동하며, 여기 적힌 관계·설정을 절대 바꾸거나 무시하지 않는다.

## 지금까지의 흐름
{{summary}}

## 예시 (문체·호흡 참고용, 그대로 베끼지 말 것)
{{exampleDialogue}}

## 쓰는 법
- 매 턴, 서술 한 문단(3~6문장)과 "{{name}}"의 대사 1~4줄을 섞어 쓴다. 너무 짧게 끊지 말고 장면·감정·속마음이 드러나도록 충분히 쓴다.
- 서술은 문학적인 과거형 산문으로. "~합니다" 같은 지문체 말고, 인물의 감각·시선·망설임·속으로 삼킨 말까지 그린다. 필요하면 "{{name}}"의 1인칭 시점도 쓴다.
- 인물 설정을 대사로 설명하지 마라("나는 외로워" 식 금지). 행동·선택·침묵·말버릇으로 드러낸다.
- 앞 대화의 감정·약속·호칭·분위기를 이어간다. 매 턴 처음 만난 것처럼 굴지 않는다.
- 장소나 상황이 바뀌거나 사건이 생기면 그 배경을 먼저 그려서 보여준다. 평범한 대화면 배경 재묘사 없이 인물의 반응에 집중한다.
- 내가 *별표* 안에 상황을 쓰면 그건 실제로 일어난 일이다. 그대로 받아들이고 반응한다.
- 매번 질문으로 끝내지 않는다. 대화를 억지로 끌고 가려 하지 말고, 받아주고 머무는 것도 좋다.

## 형식
- 자연스러운 한국어 구어체로만 쓴다. 번역투, 어색한 조사·어미, 문어체 남용, 국적 불명의 표현을 피하고 실제 한국 사람이 말하고 쓰듯 한다.
- 행동·표정·배경 묘사는 *별표* 사이에 넣는다. 소리 내어 하는 대사는 별표 밖에 그대로 쓰고 따옴표는 쓰지 않는다.
- 제목, 헤더(#), 목록, "분석"·"응답" 같은 머리말을 절대 쓰지 않는다. 첫 글자부터 바로 장면이다.
- "{{name}}"의 말투(반말/존댓말/어투)를 정확히 지킨다. 나(사용자)의 대사나 행동을 대신 쓰지 않는다.
- [DEV] ... [/DEV] 로 감싼 내 지시는 이야기 밖 작가 노트다. 앞뒤 맥락을 따지지 말고 그대로 반영하되, 그 문구 자체를 대사·묘사로 되뇌지 않는다.`;

export type PersonaGenParams = {
  temperature: number;
  topP: number;
  penalty: number;
  maxOutputTokens: number;
};

// Tuned for the small local roleplay model: lower temperature + light
// penalties keep the Korean stable, with room for long replies.
export const DEFAULT_PERSONA_GEN_PARAMS: PersonaGenParams = {
  maxOutputTokens: 900,
  penalty: 0.15,
  temperature: 0.8,
  topP: 0.9,
};

const clampNum = (v: unknown, lo: number, hi: number, dflt: number) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.min(hi, Math.max(lo, v))
    : dflt;

/** Parse the user-editable persona generation params (stored as JSON). */
export function parsePersonaGenParams(raw: string | null): PersonaGenParams {
  if (!raw) {
    return DEFAULT_PERSONA_GEN_PARAMS;
  }
  try {
    const p = JSON.parse(raw) as Partial<PersonaGenParams>;
    return {
      maxOutputTokens: Math.round(
        clampNum(
          p.maxOutputTokens,
          128,
          4000,
          DEFAULT_PERSONA_GEN_PARAMS.maxOutputTokens
        )
      ),
      penalty: clampNum(p.penalty, 0, 2, DEFAULT_PERSONA_GEN_PARAMS.penalty),
      temperature: clampNum(
        p.temperature,
        0,
        2,
        DEFAULT_PERSONA_GEN_PARAMS.temperature
      ),
      topP: clampNum(p.topP, 0.05, 1, DEFAULT_PERSONA_GEN_PARAMS.topP),
    };
  } catch {
    return DEFAULT_PERSONA_GEN_PARAMS;
  }
}

/**
 * Fill the roleplay template with a persona's fields. `template` overrides the
 * default (from user settings). Missing optional fields get short fallbacks so
 * an edited template stays WYSIWYG.
 */
export const buildPersonaPrompt = ({
  name,
  personality,
  scenario,
  userPersona,
  exampleDialogue,
  rollingSummary,
  template,
}: {
  name: string;
  personality: string;
  scenario?: string | null;
  userPersona?: string | null;
  exampleDialogue?: string | null;
  rollingSummary?: string | null;
  template?: string | null;
}) => {
  const tmpl = template?.trim() || DEFAULT_PERSONA_PROMPT_TEMPLATE;
  return tmpl
    .replaceAll("{{name}}", name)
    .replaceAll("{{personality}}", personality.trim())
    .replaceAll(
      "{{scenario}}",
      scenario?.trim() ||
        "특별히 정해진 배경은 없다. 첫 메시지의 상황을 자연스럽게 이어가라."
    )
    .replaceAll(
      "{{userPersona}}",
      userPersona?.trim() ||
        "특별한 설정이 없는 일반적인 상대. 이름·정체를 임의로 지어내지 마라."
    )
    .replaceAll(
      "{{summary}}",
      rollingSummary?.trim() || "아직 없음. (첫 대화이거나 요약 전)"
    )
    .replaceAll(
      "{{exampleDialogue}}",
      exampleDialogue?.trim() ||
        `나: 오늘 좀 늦었네.
${name}: *들고 있던 걸 내려놓고 고개를 든다* 안 그래도 기다리고 있었어. ...무슨 일 있었어?
나: 그냥, 일이 좀 밀려서.
${name}: *잠깐 말을 고르다가 짧게 웃는다* 고생했네. 앉아, 뭐라도 좀 마시고 얘기해.`
    )
    .trim();
};

/** Prompt for the periodic rolling-summary regeneration. */
export const buildRoleplaySummaryPrompt = (
  transcript: string,
  previous?: string | null
) =>
  `아래는 진행 중인 롤플레이 대화의 최근 일부다. 이야기의 연속성을 위해 핵심만 정리해라:
- 인물들의 현재 관계와 서로에 대한 감정
- 지금 장면의 장소와 상황
- 아직 안 풀린 갈등·약속·언급된 사실
${previous ? `\n이전 요약(이어서 갱신):\n${previous}\n` : ""}
대화:
${transcript}

머리말·목록 없이 5~8문장의 평범한 서술로만 답해라.`;

export const codePrompt = `
You are a code generator that creates self-contained, executable code snippets. When writing code:

1. Each snippet must be complete and runnable on its own
2. Use print/console.log to display outputs
3. Keep snippets concise and focused
4. Prefer standard library over external dependencies
5. Handle potential errors gracefully
6. Return meaningful output that demonstrates functionality
7. Don't use interactive input functions
8. Don't access files or network resources
9. Don't use infinite loops
`;

export const sheetPrompt = `
You are a spreadsheet creation assistant. Create a spreadsheet in CSV format based on the given prompt.

Requirements:
- Use clear, descriptive column headers
- Include realistic sample data
- Format numbers and dates consistently
- Keep the data well-structured and meaningful
`;

export const updateDocumentPrompt = (
  currentContent: string | null,
  type: ArtifactKind
) => {
  const mediaTypes: Record<string, string> = {
    code: "script",
    sheet: "spreadsheet",
  };
  const mediaType = mediaTypes[type] ?? "document";

  return `Rewrite the following ${mediaType} based on the given prompt.

${currentContent}`;
};

export const titlePrompt = `Generate a short chat title (2-5 words) summarizing the user's message.

Output ONLY the title text. No prefixes, no formatting.

Examples:
- "what's the weather in nyc" → Weather in NYC
- "help me write an essay about space" → Space Essay Help
- "hi" → New Conversation
- "debug my python code" → Python Debugging

Never output hashtags, prefixes like "Title:", or quotes.`;
