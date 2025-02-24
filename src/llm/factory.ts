import type { LLMConfig } from "@/config";
import { LLMAnthropic } from "./anthropic";
import { LLMGoogle } from "./google";
import type { LLM } from "./llm";
import { LLMOpenAI } from "./openai";
import { LLMStub } from "./stub";

export function createLLM(settings: LLMConfig): LLM {
  const { provider, openai, anthropic, google } = settings;
  if (provider === "openai") {
    return new LLMOpenAI(openai);
  }
  if (provider === "anthropic") {
    return new LLMAnthropic(anthropic);
  }
  if (provider === "google") {
    return new LLMGoogle(google);
  }
  if (provider === "stub") {
    return new LLMStub(settings.stub.response);
  }
  throw new Error(`Unknown LLM provider: ${provider}`);
}
