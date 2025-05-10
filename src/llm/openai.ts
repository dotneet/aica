import type { LLMConfigOpenAI } from "@/config";
import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod";

import {
  type LLM,
  LLMError,
  type LLMOptions,
  LLMRateLimitError,
  type Message,
  withRetry,
} from "./llm";
import { type LLMLogger, createLLMLogger } from "./logger";

interface GPTResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export type OpenAIReasoningEffort = "low" | "medium" | "high";

export class LLMOpenAI implements LLM {
  private apiKey: string;
  private model: string;
  private temperature: number;
  private maxCompletionTokens: number;
  private reasoningEffort?: OpenAIReasoningEffort;
  private logger: LLMLogger;

  constructor(config: LLMConfigOpenAI) {
    if (!config.apiKey) {
      throw new Error("OpenAI API key is not set");
    }
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.temperature = config.temperature;
    this.maxCompletionTokens = config.maxCompletionTokens;
    this.reasoningEffort = config.reasoningEffort;
    this.logger = createLLMLogger(config.logFile);
  }

  public async generate(
    systemPrompt: string,
    messages: Message[],
    jsonMode: boolean,
    responseSchema?: z.ZodSchema,
    options?: LLMOptions,
  ): Promise<string> {
    this.logger.logRequest(systemPrompt, messages);

    const responseObject = await withRetry(
      async () =>
        this.fetchOpenAIResponse(
          this.apiKey,
          this.model,
          systemPrompt,
          messages,
          jsonMode,
          responseSchema,
        ),
      options,
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
    responseSchema?: z.ZodSchema,
  ): Promise<GPTResponse> {
    let additionalBody = {};
    // o1 model does not support system role
    const isOSeriesModel = model.indexOf("o") === 0;
    const systemRole = isOSeriesModel ? "user" : "system";
    const temperature = isOSeriesModel ? undefined : this.temperature;
    if (jsonMode) {
      if (isOSeriesModel && responseSchema) {
        additionalBody = {
          response_format: zodResponseFormat(responseSchema, "response"),
        };
      } else if (!isOSeriesModel) {
        additionalBody = {
          response_format: { type: "json_object" },
        };
      }
    }

    // Set reasoning_effort only for o-series models
    if (isOSeriesModel && this.reasoningEffort) {
      additionalBody = {
        ...additionalBody,
        reasoning_effort: this.reasoningEffort,
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
      if (response.status === 429) {
        throw new LLMRateLimitError("Rate limit exceeded");
      }
      throw new LLMError(`OpenAI API error: ${body.error.message}`);
    }
    return await response.json();
  }
}
