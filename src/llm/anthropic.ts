import { LLM, Message } from "./llm";

type ClaudeMessageResponse = {
  id: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  role: string;
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
};

type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | Array<{ type: string; text: string }>;
};

export class LLMAnthropic implements LLM {
  constructor(private apiKey: string, private model: string) {}

  async generate(
    systemPrompt: string,
    messages: Message[],
    jsonMode: boolean,
  ): Promise<string> {
    const anthropicMessages: AnthropicMessage[] = messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    if (jsonMode) {
      messages.push({
        role: "assistant",
        content: "{",
      });
    }

    const payload = JSON.stringify({
      model: this.model,
      max_tokens: 4096,
      messages: anthropicMessages,
      system: systemPrompt,
      temperature: jsonMode ? 0.0 : 1.0,
    });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-Key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: payload,
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw new Error(
        `Anthropic API error: ${response.status} - ${JSON.stringify(
          errorData,
        )}`,
      );
    }

    const jsonResponse: ClaudeMessageResponse = await response.json();

    if (!jsonResponse.content || jsonResponse.content.length === 0) {
      throw new Error(
        "Invalid response from Anthropic API: No content received",
      );
    }

    let text = jsonResponse.content[0].text;
    if (jsonMode) {
      if (!text.startsWith("{")) {
        text = `{${text}`;
      }
      if (!text.endsWith("}")) {
        text = `${text}}`;
      }
      return text;
    }
    return text;
  }
}
