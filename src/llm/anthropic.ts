import { LLMConfigAnthropic } from "@/config";
import { extractJsonFromText, LLM, Message } from "./llm";
import { createLLMLogger, LLMLogger } from "./logger";

type ClaudeMessageResponse = {
  id: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  role: string;
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
};

type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | Array<{ type: string; text: string }>;
};

export class LLMAnthropic implements LLM {
  private apiKey: string;
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private logger: LLMLogger;

  constructor(config: LLMConfigAnthropic) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.temperature = config.temperature;
    this.maxTokens = config.maxTokens;
    this.logger = createLLMLogger(config.logFile);
  }

  async generate(
    systemPrompt: string,
    messages: Message[],
    jsonMode: boolean,
  ): Promise<string> {
    this.logger.logRequest(systemPrompt, messages);

    const anthropicMessages: AnthropicMessage[] = messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    const payload = JSON.stringify({
      model: this.model,
      max_tokens: this.maxTokens,
      messages: anthropicMessages,
      system: systemPrompt,
      temperature: this.temperature,
    });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-Key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: payload,
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw new Error(
        `Anthropic API error: ${response.status} - ${JSON.stringify(
          errorData,
        )}`,
      );
    }

    const jsonResponse: ClaudeMessageResponse = await response.json();

    if (!jsonResponse.content || jsonResponse.content.length === 0) {
      throw new Error(
        "Invalid response from Anthropic API: No content received",
      );
    }

    let text = jsonResponse.content[0].text;
    if (jsonMode) {
      const json = extractJsonFromText(text);
      if (json) {
        this.logger.log(`LLM Anthropic response: ${json}`);
        return json;
      } else {
        throw new Error(
          "Invalid response from Anthropic API: No JSON received",
        );
      }
    }
    this.logger.log(`LLM Anthropic response: ${text}`);
    return text;
  }
}
