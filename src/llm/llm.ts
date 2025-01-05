export interface LLM {
  generate(
    systemPrompt: string,
    prompt: string,
    jsonMode: boolean,
  ): Promise<string>;
}

export class LLMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMError";
  }
}
