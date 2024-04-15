import { LLM } from "./llm";

type ClaudeMessageResponse = {
  id: string;
  content: { type: string; text: string }[];
  model: string;
  stop_reason: string;
  stop_sequence: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
};

export class LLMAnthropic implements LLM {
  constructor(private apiKey: string, private model: string) {}
  async generate(
    systemPrompt: string,
    userPrompt: string,
    jsonMode: boolean
  ): Promise<string> {
    const prefill = [];
    if (jsonMode) {
      prefill.push({
        role: "assistant",
        content: "{",
      });
    }
    const payload = JSON.stringify({
      model: this.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
        ...prefill,
      ],
    });
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      verbose: true,
      method: "POST",
      headers: {
        "user-agent": "curl/8.4.0",
        "accept-encoding": "gzip",
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: payload,
    });
    const jsonResponse: ClaudeMessageResponse = await response.json();
    if (jsonMode) {
      return "{" + jsonResponse.content[0].text;
    }
    return jsonResponse.content[0].text;
  }
}
