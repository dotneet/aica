import { LLM, Message } from "./llm";

export class LLMStub implements LLM {
  constructor(private response: string) {}

  async generate(
    systemPrompt: string,
    messages: Message[],
    jsonMode: boolean,
  ): Promise<string> {
    return this.response;
  }
}
