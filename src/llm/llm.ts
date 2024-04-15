export interface LLM {
  generate(
    systemPrompt: string,
    prompt: string,
    jsonMode: boolean
  ): Promise<string>;
}
