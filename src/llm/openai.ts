import { LLM } from "./llm";

interface GPTResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export class LLMOpenAI implements LLM {
  constructor(private apiKey: string, private model: string) {}

  public async generate(
    systemPrompt: string,
    prompt: string,
    jsonMode: boolean
  ): Promise<string> {
    const responseObject = await this.fetchOpenAIResponse(
      this.apiKey,
      this.model,
      systemPrompt,
      prompt,
      jsonMode
    );
    return responseObject.choices[0].message.content;
  }

  private async fetchOpenAIResponse(
    openaiApiKey: string,
    model: string,
    systemPrompt: string,
    prompt: string,
    jsonMode: boolean
  ): Promise<GPTResponse> {
    let additionalBody = {};
    if (jsonMode) {
      additionalBody = {
        response_format: { type: "json_object" },
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
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2,
        ...additionalBody,
      }),
    });
    return await response.json();
  }
}
