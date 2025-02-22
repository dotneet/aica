export interface LLMOptions {
  maxRetries?: number;
  retryDelay?: number;
}

export interface LLM {
  generate(
    systemPrompt: string,
    prompts: Message[],
    jsonMode: boolean,
    options?: LLMOptions,
  ): Promise<string>;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: LLMOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const retryDelay = options.retryDelay ?? 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      let backoffDelay = retryDelay * Math.pow(2, attempt - 1);
      console.warn(
        `LLM attempt ${attempt} failed, retrying in ${backoffDelay}ms...`,
      );
      if (error instanceof LLMRateLimitError) {
        backoffDelay = 20 * 1000;
      }
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    }
  }
  // This should never be reached due to throw in the loop
  throw new Error("Unexpected end of retry loop");
}

export type Message = UserMessage | AssistantMessage;

export type UserMessage = {
  role: "user";
  content: string;
};

export type AssistantMessage = {
  role: "assistant";
  content: string;
};

export class LLMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMError";
  }
}

export class LLMTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMTimeoutError";
  }
}

export class LLMRateLimitError extends Error {
  retryAfter: number | undefined;
  constructor(message: string, retryAfter?: number) {
    super(message);
    this.name = "LLMRateLimitError";
    this.retryAfter = retryAfter;
  }
}

/**
 * Function to extract the first JSON from text
 * @param text input text
 * @returns found JSON text, or null if not found
 */
export function extractJsonFromText(text: string): string | null {
  // Regular expression to find JSON in code blocks
  const codeBlockRegex = /```(?:json)?\n({[\s\S]*?})\n```/;
  // Regular expression to find JSON in regular text (handles nested JSON)
  const jsonRegex = /{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*}/;

  // First search in code blocks
  const codeBlockMatch = text.match(codeBlockRegex);
  if (codeBlockMatch) {
    try {
      // Validate extracted text is valid JSON
      JSON.parse(codeBlockMatch[1]);
      return codeBlockMatch[1];
    } catch {
      // If invalid JSON, continue to next search
    }
  }

  // Then search in regular text
  const matches = text.match(jsonRegex);
  if (matches) {
    try {
      // Validate extracted text is valid JSON
      JSON.parse(matches[0]);
      return matches[0];
    } catch {
      return null;
    }
  }

  return null;
}
