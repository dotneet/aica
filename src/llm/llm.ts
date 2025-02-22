export interface LLM {
  generate(
    systemPrompt: string,
    prompts: Message[],
    jsonMode: boolean,
  ): Promise<string>;
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
