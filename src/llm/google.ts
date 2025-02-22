import { LLMConfigGemini } from "@/config";
import { LLM, LLMError, Message } from "./llm";
import { createLLMLogger, LLMLogger } from "./logger";

export class LLMGoogle implements LLM {
  private config: LLMConfigGemini;
  private logger: LLMLogger;

  constructor(config: LLMConfigGemini) {
    this.config = config;
    this.logger = createLLMLogger(config.logFile);
    console.log("created logger with logFile: ", config.logFile);
  }

  async generate(
    systemPrompt: string,
    prompts: Message[],
    jsonMode: boolean,
  ): Promise<string> {
    this.logger.log("================================================");
    this.logger.log(`System Prompt: ${systemPrompt}`);
    this.logger.log(
      `User Prompts: ${prompts.map((p) => p.content).join("==========\n")}`,
    );

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

    try {
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
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!data.candidates || data.candidates.length === 0) {
        throw new Error("No response from Google");
      }

      const result = data.candidates[0].content.parts[0].text;
      this.logger.log(`LLM Google response: ${result}`);
      return result;
    } catch (error: unknown) {
      throw new LLMError(
        `Google API error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
