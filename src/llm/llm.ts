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
