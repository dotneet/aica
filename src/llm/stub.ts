import { LLM } from "./llm";

export class LLMStub implements LLM {
  constructor(private response: string) {}

  async generate(
    systemPrompt: string,
    userPrompt: string,
    jsonMode: boolean,
  ): Promise<string> {
    return this.response;
  }
}
