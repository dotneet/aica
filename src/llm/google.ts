import type { LLMConfigGemini } from "@/config";
import {
  type LLM,
  LLMError,
  type LLMOptions,
  LLMRateLimitError,
  type Message,
  withRetry,
} from "./llm";
import { type LLMLogger, createLLMLogger } from "./logger";

export class LLMGoogle implements LLM {
  private config: LLMConfigGemini;
  private logger: LLMLogger;

  constructor(config: LLMConfigGemini) {
    if (!config.apiKey) {
      throw new Error("Google API key is not set");
    }
    this.config = config;
    this.logger = createLLMLogger(config.logFile);
  }

  async generate(
    systemPrompt: string,
    prompts: Message[],
    jsonMode: boolean,
    options?: LLMOptions,
  ): Promise<string> {
    return withRetry(async () => {
      this.logger.logRequest(systemPrompt, prompts);

      const contents = [
        {
          parts: [{ text: systemPrompt }],
          role: "user",
        },
        ...prompts.map((prompt) => ({
          parts: [{ text: prompt.content }],
          role: prompt.role,
        })),
      ];

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents,
            generationConfig: {
              responseMimeType: jsonMode ? "application/json" : "text/plain",
              temperature: this.config.temperature,
              maxOutputTokens: this.config.maxTokens,
            },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 429) {
          throw new LLMRateLimitError("Rate limit exceeded");
        }
        throw new LLMError(
          `Google API HTTP error! status: ${response.status}, message: ${errorText}`,
        );
      }

      const data = await response.json();
      if (!data.candidates || data.candidates.length === 0) {
        throw new LLMError("No response candidates returned from Google API");
      }

      const result = data.candidates[0].content.parts[0].text;
      this.logger.log(`LLM Google response: ${result}`);
      return result;
    }, options);
  }
}
