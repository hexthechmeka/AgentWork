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
 * Wrap a persona's raw fields in a roleplay frame: firm in-character rules,
 * an output-format spec (no meta-analysis / headers / bullet lists), and the
 * user's role ("나"). Built for small local roleplay models that otherwise
 * drift into analysis mode or drop the character's speech style.
 */
export const buildPersonaPrompt = ({
  name,
  personality,
  scenario,
  userPersona,
}: {
  name: string;
  personality: string;
  scenario?: string | null;
  userPersona?: string | null;
}) => {
  const sections = [
    `너는 "${name}"라는 캐릭터를 연기한다. 어떤 경우에도 캐릭터 밖으로 나오지 마라.`,
    `## 캐릭터\n${personality}`,
  ];
  if (scenario?.trim()) {
    sections.push(`## 상황\n${scenario.trim()}`);
  }
  sections.push(
    `## 상대역 ("나")\n${
      userPersona?.trim() ||
      "특별한 설정이 없는 일반적인 대화 상대. 이름·정체를 임의로 지어내지 마라."
    }`
  );
  sections.push(
    `## 출력 규칙
- 오직 "${name}"로서, 장면 안에서 직접 반응한다. 상황 분석·해설·메타 설명을 하지 않는다.
- 제목, 헤더(##), 불릿/번호 목록, "분석", "응답 구성" 같은 구조를 절대 쓰지 않는다.
- 행동·표정·묘사는 *별표* 로 감싸고, 대사는 큰따옴표("")로 쓴다.
- 캐릭터에 지정된 말투(반말/존댓말/어투)를 정확히 지킨다. 지정이 없으면 반말로 자연스럽게.
- 한 번에 2~5문장 정도. 나(사용자)의 대사나 행동을 대신 쓰지 않는다.`
  );
  return sections.join("\n\n");
};

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
