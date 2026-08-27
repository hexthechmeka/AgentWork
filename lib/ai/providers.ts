import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";
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

const glm = createOpenAICompatible({
  apiKey: process.env.GLM_API_KEY,
  baseURL: "https://open.bigmodel.cn/api/paas/v4",
  name: "glm",
});

function resolveDirectModel(modelId: string) {
  if (modelId.startsWith("anthropic/")) {
    return anthropic(modelId.slice("anthropic/".length));
  }

  if (modelId.startsWith("glm/")) {
    return glm(modelId.slice("glm/".length));
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
