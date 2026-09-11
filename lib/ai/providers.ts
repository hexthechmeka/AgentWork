import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { customProvider, type LanguageModel } from "ai";
import { isTestEnvironment } from "../constants";
import { AICHAT_CONFIG, AICHAT_PROVIDER } from "./aichat-provider";
import { titleModel } from "./models";

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        chatModel,
        titleModel: mockTitleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "title-model": mockTitleModel,
        },
      });
    })()
  : null;

// Thrown by resolveUserModels()/languageModel() when the requesting user
// hasn't registered the key a model id needs. Callers should catch this and
// turn it into a "연동 설정에서 OO 키를 등록하세요" response — never a bare
// 500 / silent stream failure.
export class MissingCredentialError extends Error {
  provider: "anthropic" | "glm";

  constructor(provider: "anthropic" | "glm") {
    super(`Missing credential for provider: ${provider}`);
    this.provider = provider;
    this.name = "MissingCredentialError";
  }
}

const PROVIDER_LABEL: Record<MissingCredentialError["provider"], string> = {
  anthropic: "Anthropic",
  glm: "GLM",
};

/** User-facing copy for a MissingCredentialError — same message everywhere
 * a chat/generation call can hit it (route handlers, server actions,
 * stream error callbacks). */
export function missingCredentialMessage(
  error: MissingCredentialError
): string {
  return `연동 설정에서 ${PROVIDER_LABEL[error.provider]} API 키를 등록하세요.`;
}

async function loggingGlmFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  if (typeof init?.body === "string") {
    try {
      const body = JSON.parse(init.body);
      console.log(
        "GLM request:",
        JSON.stringify(
          {
            messageCount: Array.isArray(body.messages)
              ? body.messages.length
              : undefined,
            messages: body.messages,
            model: body.model,
            reasoning_effort: body.reasoning_effort,
          },
          null,
          2
        )
      );
    } catch (error) {
      console.error("GLM request logging failed to parse body:", error);
    }
  }

  const response = await fetch(input, init);

  if (!response.ok) {
    const bodyText = await response.clone().text();
    console.error("GLM API returned an error:", response.status, bodyText);
  }

  return response;
}

// aichat (the roleplay RunPod backend) is Sean's own deployment, not a
// per-user BYOK credential — stays a module-scope singleton on env vars,
// same as before.
const aichat = createOpenAICompatible({
  apiKey: AICHAT_CONFIG.apiKey,
  baseURL: AICHAT_CONFIG.baseURL,
  // llama.cpp only emits a final usage chunk when asked (stream_options).
  includeUsage: true,
  name: AICHAT_PROVIDER,
});

export type UserModelCredentials = {
  anthropicApiKey?: string | null;
  glmApiKey?: string | null;
};

/**
 * Builds model accessors bound to one request's resolved BYOK credentials.
 * `anthropic/` and `glm/` clients are created fresh here (no module-scope
 * singleton, no shared client across users/requests) from the caller's own
 * keys; throws MissingCredentialError if the model's provider has no key.
 * `aichat/` still goes through the shared env-based client above.
 */
export function resolveUserModels(creds: UserModelCredentials) {
  function languageModel(modelId: string): LanguageModel {
    if (isTestEnvironment && myProvider) {
      return myProvider.languageModel(modelId);
    }

    if (modelId.startsWith("anthropic/")) {
      if (!creds.anthropicApiKey) {
        throw new MissingCredentialError("anthropic");
      }
      const anthropic = createAnthropic({ apiKey: creds.anthropicApiKey });
      return anthropic(modelId.slice("anthropic/".length));
    }

    if (modelId.startsWith("glm/")) {
      if (!creds.glmApiKey) {
        throw new MissingCredentialError("glm");
      }
      const glm = createOpenAICompatible({
        apiKey: creds.glmApiKey,
        baseURL: "https://open.bigmodel.cn/api/paas/v4",
        fetch: loggingGlmFetch,
        name: "glm",
      });
      return glm(modelId.slice("glm/".length));
    }

    if (modelId.startsWith(`${AICHAT_PROVIDER}/`)) {
      return aichat(modelId.slice(`${AICHAT_PROVIDER}/`.length));
    }

    throw new Error(`Unsupported model id: ${modelId}`);
  }

  function getTitleModel(): LanguageModel {
    if (isTestEnvironment && myProvider) {
      return myProvider.languageModel("title-model");
    }
    return languageModel(titleModel.id);
  }

  return { languageModel, titleModel: getTitleModel };
}

export type UserModels = ReturnType<typeof resolveUserModels>;
