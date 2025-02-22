import { LLMConfigOpenAI } from "@/config";
import { LLM, LLMError, Message } from "./llm";
import { createLLMLogger, LLMLogger } from "./logger";

interface GPTResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export class LLMOpenAI implements LLM {
  private apiKey: string;
  private model: string;
  private temperature: number;
  private maxCompletionTokens: number;
  private logger: LLMLogger;

  constructor(config: LLMConfigOpenAI) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.temperature = config.temperature;
    this.maxCompletionTokens = config.maxCompletionTokens;
    this.logger = createLLMLogger(config.logFile);
  }

  public async generate(
    systemPrompt: string,
    messages: Message[],
    jsonMode: boolean,
  ): Promise<string> {
    this.logger.log("================================================");
    this.logger.log(`System Prompt: ${systemPrompt}`);
    this.logger.log(
      `User Prompts: ${messages.map((p) => p.content).join("==========\n")}`,
    );

    const responseObject = await this.fetchOpenAIResponse(
      this.apiKey,
      this.model,
      systemPrompt,
      messages,
      jsonMode,
    );
    const result = responseObject.choices[0].message.content;
    this.logger.log(`LLM OpenAI response: ${result}`);
    return result;
  }

  private async fetchOpenAIResponse(
    openaiApiKey: string,
    model: string,
    systemPrompt: string,
    messages: Message[],
    jsonMode: boolean,
  ): Promise<GPTResponse> {
    let additionalBody = {};
    // o1 model does not support system role
    const isO1Model = model.indexOf("o") === 0;
    const systemRole = isO1Model ? "user" : "system";
    const temperature = isO1Model ? undefined : this.temperature;
    if (jsonMode && !isO1Model) {
      additionalBody = {
        response_format: { type: "json_object" },
      };
    }
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model,
        max_completion_tokens: this.maxCompletionTokens,
        messages: [
          {
            role: systemRole,
            content: systemPrompt,
          },
          ...messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        ],
        temperature,
        ...additionalBody,
      }),
    });
    if (!response.ok) {
      const body = await response.json();
      throw new LLMError(`OpenAI API error: ${body.error.message}`);
    }
    return await response.json();
  }
}
