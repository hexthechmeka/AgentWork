import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { customProvider } from "ai";
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

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

const glm = createOpenAICompatible({
  apiKey: process.env.GLM_API_KEY,
  baseURL: "https://open.bigmodel.cn/api/paas/v4",
  fetch: loggingGlmFetch,
  name: "glm",
});

const aichat = createOpenAICompatible({
  apiKey: AICHAT_CONFIG.apiKey,
  baseURL: AICHAT_CONFIG.baseURL,
  // llama.cpp only emits a final usage chunk when asked (stream_options).
  includeUsage: true,
  name: AICHAT_PROVIDER,
});

function resolveDirectModel(modelId: string) {
  if (modelId.startsWith("anthropic/")) {
    return anthropic(modelId.slice("anthropic/".length));
  }

  if (modelId.startsWith("glm/")) {
    return glm(modelId.slice("glm/".length));
  }

  if (modelId.startsWith(`${AICHAT_PROVIDER}/`)) {
    return aichat(modelId.slice(`${AICHAT_PROVIDER}/`.length));
  }

  throw new Error(`Unsupported model id: ${modelId}`);
}

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

  return resolveDirectModel(modelId);
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }

  return resolveDirectModel(titleModel.id);
}
