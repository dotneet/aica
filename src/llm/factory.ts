import { LLMConfig } from "@/config";
import { LLMAnthropic } from "./anthropic";
import { LLM } from "./llm";
import { LLMOpenAI } from "./openai";

export function createLLM(settings: LLMConfig): LLM {
  const { provider, openai, anthropic } = settings;
  if (provider === "openai") {
    return new LLMOpenAI(openai.apiKey, openai.model);
  } else if (provider === "anthropic") {
    return new LLMAnthropic(anthropic.apiKey, anthropic.model);
  } else {
    throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
