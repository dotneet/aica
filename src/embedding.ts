export class EmbeddingProducer {
  constructor(
    private readonly openAiApiKey: string,
    private readonly embeddingModel: string
  ) {}

  async getEmbedding(text: string) {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.openAiApiKey}`,
      },
      body: JSON.stringify({ model: this.embeddingModel, input: text }),
    });
    const { data } = await response.json();
    return data[0].embedding;
  }
}
