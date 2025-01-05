import { LLMConfig } from "@/config";
import { LLMAnthropic } from "./anthropic";
import { LLM } from "./llm";
import { LLMOpenAI } from "./openai";
import { LLMStub } from "./stub";

export function createLLM(settings: LLMConfig): LLM {
  const { provider, openai, anthropic } = settings;
  if (provider === "openai") {
    return new LLMOpenAI(openai.apiKey, openai.model);
  } else if (provider === "anthropic") {
    return new LLMAnthropic(anthropic.apiKey, anthropic.model);
  } else if (provider === "stub") {
    return new LLMStub(settings.stub.response);
  } else {
    throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
