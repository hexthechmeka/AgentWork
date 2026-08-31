import { geolocation, ipAddress } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  generateText,
  isStepCount,
  streamText,
  toUIMessageStream,
} from "ai";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { auth, type UserType } from "@/app/(auth)/auth";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import {
  allowedModelIds,
  chatModels,
  DEFAULT_CHAT_MODEL,
  GLM_VISION_MODEL_ID,
  getCapabilities,
  getModelAvailability,
} from "@/lib/ai/models";
import {
  buildPersonaPrompt,
  buildRoleplaySummaryPrompt,
  parsePersonaGenParams,
  type RequestHints,
  systemPrompt,
  type UnifiedChatIdentity,
} from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocument } from "@/lib/ai/tools/create-document";
import { editDocument } from "@/lib/ai/tools/edit-document";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { trackUsage } from "@/lib/ai/usage";
import { isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  getPersonaById,
  getPlayerPersonaById,
  getProjectById,
  getSetting,
  isProviderHardLocked,
  saveChat,
  saveMessages,
  setChatRollingSummary,
  updateChatTitleById,
  updateMessage,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import { checkIpRateLimit } from "@/lib/ratelimit";
import type { ChatMessage, WaitingStatusData } from "@/lib/types";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

const HEALTH_CHECK_DELAY_MS = 9000;

function isModelStreamActivity(chunk: { type: string }) {
  return !["start", "start-step", "finish-step", "finish", "raw"].includes(
    chunk.type
  );
}

// GLM-5.3/5.2 (non-vision) can't accept image content at all. If an earlier
// turn in this chat attached an image (e.g. answered by the vision model),
// the AI SDK's OpenAI-compatible message conversion still unconditionally
// serializes that historical file part into an `image_url` content block —
// regardless of whether the *current* target model supports vision — which
// GLM's non-vision endpoint chokes on (observed as silent empty responses).
// Replace historical image parts with a text placeholder before building
// model messages for a non-vision GLM call.
function stripImagePartsForNonVisionGlm(
  messages: ChatMessage[],
  chatModel: string
): ChatMessage[] {
  const isNonVisionGlm =
    chatModel.startsWith("glm/") && chatModel !== GLM_VISION_MODEL_ID;
  if (!isNonVisionGlm) {
    return messages;
  }

  return messages.map((msg) => {
    if (!msg.parts?.some((part) => part.type === "file")) {
      return msg;
    }
    return {
      ...msg,
      parts: msg.parts.map((part) => {
        if (part.type !== "file") {
          return part;
        }
        const filename =
          (part as { filename?: string; name?: string }).filename ??
          (part as { name?: string }).name;
        return {
          text: `[이미지 첨부됨${filename ? `: ${filename}` : ""}]`,
          type: "text" as const,
        };
      }),
    };
  });
}

function tagAssistantMessagesForUnifiedChat(
  messages: ChatMessage[]
): ChatMessage[] {
  return messages.map((msg) => {
    const modelId = msg.metadata?.modelId;
    if (msg.role !== "assistant" || !modelId) {
      return msg;
    }
    const label = modelId.startsWith("glm/") ? "GLM" : "Claude";
    return {
      ...msg,
      parts: msg.parts.map((part) =>
        part.type === "text"
          ? { ...part, text: `[${label}] ${part.text}` }
          : part
      ),
    };
  });
}

function getStreamContext() {
  try {
    return createResumableStreamContext({ waitUntil: after });
  } catch {
    return null;
  }
}

export { getStreamContext };

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch {
    return new ChatbotError("bad_request:api").toResponse();
  }

  try {
    const {
      chatKind,
      effort,
      id,
      message,
      messages,
      projectId,
      selectedChatModel,
      selectedVisibilityType,
    } = requestBody;

    const session = await auth();

    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    let chatModel = allowedModelIds.has(selectedChatModel)
      ? selectedChatModel
      : DEFAULT_CHAT_MODEL;

    // GLM-5.3/5.2 can't accept image input at all. If the user attaches an
    // image while one of them is selected, silently upgrade this turn to
    // the vision-capable GLM model instead of failing the request.
    const hasFileAttachment =
      message?.parts?.some((part) => part.type === "file") ?? false;
    if (
      hasFileAttachment &&
      chatModel.startsWith("glm/") &&
      chatModel !== GLM_VISION_MODEL_ID
    ) {
      chatModel = GLM_VISION_MODEL_ID;
    }

    let usageProvider: "anthropic" | "glm" | "aichat" = "anthropic";
    if (chatModel.startsWith("glm/")) {
      usageProvider = "glm";
    } else if (chatModel.startsWith("aichat/")) {
      usageProvider = "aichat";
    }
    if (
      await isProviderHardLocked({
        provider: usageProvider,
        userId: session.user.id,
      })
    ) {
      return new ChatbotError("rate_limit:api").toResponse();
    }

    await checkIpRateLimit(ipAddress(request));

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      differenceInHours: 1,
      id: session.user.id,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerHour) {
      return new ChatbotError("rate_limit:chat").toResponse();
    }

    const isToolApprovalFlow = Boolean(messages);

    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatbotError("forbidden:chat").toResponse();
      }
      messagesFromDb = await getMessagesByChatId({ id });
    } else if (message?.role === "user") {
      let validatedProjectId: string | null = null;

      if (projectId) {
        const project = await getProjectById({ id: projectId });

        if (!project || project.userId !== session.user.id) {
          return new ChatbotError("forbidden:chat").toResponse();
        }

        validatedProjectId = projectId;
      }

      await saveChat({
        id,
        kind: chatKind ?? "planning",
        projectId: validatedProjectId,
        title: "New chat",
        userId: session.user.id,
        visibility: selectedVisibilityType,
      });
      titlePromise = generateTitleFromUserMessage({ message });
    }

    let uiMessages: ChatMessage[];

    if (isToolApprovalFlow && messages) {
      const dbMessages = convertToUIMessages(messagesFromDb);
      const approvalStates = new Map(
        messages.flatMap(
          (m) =>
            m.parts
              ?.filter(
                (p: Record<string, unknown>) =>
                  p.state === "approval-responded" ||
                  p.state === "output-denied"
              )
              .map((p: Record<string, unknown>) => [
                String(p.toolCallId ?? ""),
                p,
              ]) ?? []
        )
      );
      uiMessages = dbMessages.map((msg) => ({
        ...msg,
        parts: msg.parts.map((part) => {
          if (
            "toolCallId" in part &&
            approvalStates.has(String(part.toolCallId))
          ) {
            return { ...part, ...approvalStates.get(String(part.toolCallId)) };
          }
          return part;
        }),
      })) as ChatMessage[];
    } else {
      uiMessages = [
        ...convertToUIMessages(messagesFromDb),
        message as ChatMessage,
      ];
    }

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      city,
      country,
      latitude,
      longitude,
    };

    if (message?.role === "user") {
      await saveMessages({
        messages: [
          {
            attachments: [],
            chatId: id,
            createdAt: new Date(),
            id: message.id,
            modelId: null,
            parts: message.parts,
            role: "user",
          },
        ],
      });
    }

    const modelConfig = chatModels.find((m) => m.id === chatModel);
    const modelCapabilities = await getCapabilities();
    const capabilities = modelCapabilities[chatModel];
    const isReasoningModel = capabilities?.reasoning === true;
    const supportsTools = capabilities?.tools === true;

    const effectiveChatKind = chat?.kind ?? chatKind ?? "planning";

    const personaRow = chat?.personaId
      ? await getPersonaById({ id: chat.personaId })
      : null;
    // "나" = the chat's selected player-persona preset, falling back to the
    // character's own built-in userPersona field.
    let playerPersonaText: string | null = personaRow?.userPersona ?? null;
    if (chat?.playerPersonaId) {
      const pp = await getPlayerPersonaById({ id: chat.playerPersonaId });
      if (pp && pp.ownerId === session.user.id) {
        playerPersonaText = pp.description;
      }
    }
    const [personaTemplate, personaGenRaw] = personaRow
      ? await Promise.all([
          getSetting("persona_prompt_template"),
          getSetting("persona_gen_params"),
        ])
      : [null, null];
    const personaPrompt = personaRow
      ? buildPersonaPrompt({
          exampleDialogue: personaRow.exampleDialogue,
          name: personaRow.name,
          personality: personaRow.personality,
          rollingSummary: chat?.rollingSummary,
          scenario: personaRow.scenario,
          template: personaTemplate,
          userPersona: playerPersonaText,
        })
      : undefined;
    const isPersonaChat = Boolean(personaRow);
    // Roleplay sampling — user-tunable from /aichat/settings. Defaults favour
    // stable Korean with room for long replies.
    const gp = parsePersonaGenParams(personaGenRaw);
    const personaGenParams = isPersonaChat
      ? {
          frequencyPenalty: gp.penalty,
          maxOutputTokens: gp.maxOutputTokens,
          presencePenalty: gp.penalty,
          temperature: gp.temperature,
          topP: gp.topP,
        }
      : {};

    const currentProvider = chatModel.startsWith("glm/") ? "GLM" : "Claude";
    const identity: UnifiedChatIdentity | undefined =
      effectiveChatKind === "unified"
        ? {
            other: currentProvider === "Claude" ? "GLM" : "Claude",
            self: currentProvider,
          }
        : undefined;

    const messagesForModel = stripImagePartsForNonVisionGlm(
      identity ? tagAssistantMessagesForUnifiedChat(uiMessages) : uiMessages,
      chatModel
    );
    const modelMessages = await convertToModelMessages(messagesForModel);

    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        const modelName = modelConfig?.name ?? chatModel;
        let hasModelActivity = false;
        let healthCheckTimer: ReturnType<typeof setTimeout> | undefined;

        const clearHealthCheckTimer = () => {
          if (healthCheckTimer) {
            clearTimeout(healthCheckTimer);
          }
        };

        const writeWaitingStatus = (
          phase: WaitingStatusData["phase"],
          messageText: string
        ) => {
          if (hasModelActivity && phase !== "thinking") {
            return;
          }
          dataStream.write({
            data: {
              message: messageText,
              modelId: chatModel,
              modelName,
              phase,
            },
            transient: true,
            type: "data-waiting-status",
          });
        };

        writeWaitingStatus("waiting", "대기 중...");

        healthCheckTimer = setTimeout(() => {
          getModelAvailability(chatModel)
            .then((availability) => {
              if (availability === "impacted") {
                writeWaitingStatus(
                  "health",
                  `${modelName} 모델이 지연되거나 일시적으로 응답하지 않을 수 있어요...`
                );
              } else {
                writeWaitingStatus("still-waiting", "계속 기다리는 중...");
              }
            })
            .catch(() => {
              writeWaitingStatus("still-waiting", "계속 기다리는 중...");
            });
        }, HEALTH_CHECK_DELAY_MS);

        const markModelActive = () => {
          if (hasModelActivity) {
            return;
          }
          hasModelActivity = true;
          clearHealthCheckTimer();
          writeWaitingStatus("thinking", "생각하는 중...");
        };

        const stopWaitingStatus = () => {
          hasModelActivity = true;
          clearHealthCheckTimer();
        };

        const result = streamText({
          ...personaGenParams,
          // No tools for models that don't support them (reasoning-only
          // models, and the aichat roleplay model — it leaks tool-call
          // syntax when it sees tool definitions).
          activeTools: supportsTools
            ? [
                "createDocument",
                "editDocument",
                "updateDocument",
                "requestSuggestions",
              ]
            : [],
          instructions: systemPrompt({
            identity,
            personaPrompt,
            requestHints,
            supportsTools,
          }),
          messages: modelMessages,
          model: getLanguageModel(chatModel),
          onAbort() {
            stopWaitingStatus();
          },
          onChunk({ chunk }) {
            if (isModelStreamActivity(chunk)) {
              markModelActive();
            }
          },
          onEnd() {
            stopWaitingStatus();
          },
          onError({ error }) {
            stopWaitingStatus();
            console.error("streamText error:", chatModel, error);
          },
          providerOptions: {
            ...(modelConfig?.reasoningEffort && {
              openai: { reasoningEffort: modelConfig.reasoningEffort },
            }),
            ...(chatModel.startsWith("anthropic/") &&
              effort && {
                anthropic: { effort },
              }),
            ...(chatModel.startsWith("glm/") &&
              effort && {
                glm: { reasoningEffort: effort },
              }),
          },
          stopWhen: isStepCount(5),
          telemetry: {
            functionId: "stream-text",
            isEnabled: isProductionEnvironment,
          },
          tools: {
            createDocument: createDocument({
              dataStream,
              modelId: chatModel,
              session,
            }),
            editDocument: editDocument({ dataStream, session }),
            requestSuggestions: requestSuggestions({
              dataStream,
              modelId: chatModel,
              session,
            }),
            updateDocument: updateDocument({
              dataStream,
              modelId: chatModel,
              session,
            }),
          },
        });

        dataStream.merge(
          toUIMessageStream({
            messageMetadata: () => ({ modelId: chatModel }),
            sendReasoning: isReasoningModel,
            stream: result.stream,
          })
        );

        (async () => {
          try {
            let modelUsage = await result.usage;
            // The build-phase RunPod (llama.cpp) backend doesn't emit a
            // streaming usage chunk. Fall back to a rough char/4 estimate so
            // the widget still shows request volume (cost is $0 anyway).
            if (
              usageProvider === "aichat" &&
              !(modelUsage?.inputTokens || modelUsage?.outputTokens)
            ) {
              const outText = await result.text;
              const inChars = modelMessages.reduce(
                (n, m) => n + JSON.stringify(m.content).length,
                0
              );
              modelUsage = {
                ...modelUsage,
                inputTokens: Math.round(inChars / 4),
                outputTokens: Math.round(outText.length / 4),
              };
            }
            await trackUsage({
              modelId: chatModel,
              usage: modelUsage,
              userId: session.user.id,
            });
          } catch {
            // usage metering is best-effort
          }
        })();

        // Rolling summary: every 6th user turn, regenerate the digest so long
        // roleplays keep continuity. Best-effort, off the response path.
        if (isPersonaChat && chat?.id) {
          const userTurns = uiMessages.filter((m) => m.role === "user").length;
          if (userTurns >= 6 && userTurns % 6 === 0) {
            (async () => {
              try {
                const replyText = await result.text;
                const speaker = personaRow?.name ?? "상대";
                const lines = uiMessages
                  .slice(-12)
                  .map((m) => {
                    const t = (m.parts ?? [])
                      .filter(
                        (p): p is { type: "text"; text: string } =>
                          p.type === "text" &&
                          typeof (p as { text?: unknown }).text === "string"
                      )
                      .map((p) => p.text)
                      .join(" ")
                      .trim();
                    return t
                      ? `${m.role === "user" ? "나" : speaker}: ${t}`
                      : "";
                  })
                  .filter(Boolean);
                lines.push(`${speaker}: ${replyText.trim()}`);

                const { text: summary } = await generateText({
                  maxOutputTokens: 400,
                  model: getLanguageModel(chatModel),
                  prompt: buildRoleplaySummaryPrompt(
                    lines.join("\n"),
                    chat.rollingSummary
                  ),
                  temperature: 0.4,
                });
                if (summary.trim()) {
                  await setChatRollingSummary({
                    chatId: chat.id,
                    summary: summary.trim(),
                  });
                }
              } catch {
                // best-effort
              }
            })();
          }
        }

        if (titlePromise) {
          try {
            const title = await titlePromise;
            dataStream.write({ data: title, type: "data-chat-title" });
            updateChatTitleById({ chatId: id, title });
          } catch {
            /* non-fatal */
          }
        }
      },
      generateId: generateUUID,
      onEnd: async ({ messages: finishedMessages }) => {
        if (isToolApprovalFlow) {
          await Promise.all(
            finishedMessages.map(async (finishedMsg) => {
              const existingMsg = uiMessages.find(
                (m) => m.id === finishedMsg.id
              );
              if (existingMsg) {
                await updateMessage({
                  id: finishedMsg.id,
                  parts: finishedMsg.parts,
                });
                return;
              }

              await saveMessages({
                messages: [
                  {
                    attachments: [],
                    chatId: id,
                    createdAt: new Date(),
                    id: finishedMsg.id,
                    modelId:
                      finishedMsg.role === "assistant" ? chatModel : null,
                    parts: finishedMsg.parts,
                    role: finishedMsg.role,
                  },
                ],
              });
            })
          );
        } else if (finishedMessages.length > 0) {
          await saveMessages({
            messages: finishedMessages.map((currentMessage) => ({
              attachments: [],
              chatId: id,
              createdAt: new Date(),
              id: currentMessage.id,
              modelId: currentMessage.role === "assistant" ? chatModel : null,
              parts: currentMessage.parts,
              role: currentMessage.role,
            })),
          });
        }
      },
      onError: (error) => {
        console.error("Chat UI message stream error:", chatModel, error);
        if (
          error instanceof Error &&
          error.message?.includes(
            "AI Gateway requires a valid credit card on file to service requests"
          )
        ) {
          return "AI Gateway requires a valid credit card on file to service requests. Please visit https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card to add a card and unlock your free credits.";
        }
        return "Oops, an error occurred!";
      },
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
    });

    return createUIMessageStreamResponse({
      async consumeSseStream({ stream: sseStream }) {
        if (!process.env.REDIS_URL) {
          return;
        }
        try {
          const streamContext = getStreamContext();
          if (streamContext) {
            const streamId = generateId();
            await createStreamId({ chatId: id, streamId });
            await streamContext.createNewResumableStream(
              streamId,
              () => sseStream
            );
          }
        } catch {
          /* non-critical */
        }
      },
      stream,
    });
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatbotError) {
      return error.toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatbotError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
