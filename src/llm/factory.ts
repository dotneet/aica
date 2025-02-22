import { LLMConfig } from "@/config";
import { LLMAnthropic } from "./anthropic";
import { LLMGoogle } from "./google";
import { LLM } from "./llm";
import { LLMOpenAI } from "./openai";
import { LLMStub } from "./stub";

export function createLLM(settings: LLMConfig): LLM {
  const { provider, openai, anthropic, google } = settings;
  if (provider === "openai") {
    return new LLMOpenAI(openai);
  } else if (provider === "anthropic") {
    return new LLMAnthropic(anthropic);
  } else if (provider === "google") {
    return new LLMGoogle(google);
  } else if (provider === "stub") {
    return new LLMStub(settings.stub.response);
  } else {
    throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
