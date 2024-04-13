interface GPTResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export class LLM {
  constructor(private openaiApiKey: string, private model: string) {}

  public async generate(systemPrompt: string, prompt: string): Promise<string> {
    const responseObject = await this.fetchOpenAIResponse(
      this.openaiApiKey,
      this.model,
      systemPrompt,
      prompt
    );
    return responseObject.choices[0].message.content;
  }

  private async fetchOpenAIResponse(
    openaiApiKey: string,
    model: string,
    systemPrompt: string,
    prompt: string
  ): Promise<GPTResponse> {
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
        response_format: { type: "json_object" },
      }),
    });
    return await response.json();
  }
}
