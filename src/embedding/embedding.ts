export class EmbeddingProducer {
  constructor(
    private readonly openAiApiKey: string,
    private readonly embeddingModel: string,
  ) {
    if (!this.openAiApiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    if (!this.embeddingModel) {
      throw new Error("EMBEDDING_MODEL is not set");
    }
  }

  async getEmbedding(text: string) {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.openAiApiKey}`,
      },
      body: JSON.stringify({ model: this.embeddingModel, input: text }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to get embedding: ${text}`);
    }
    const { data } = await response.json();
    return data[0].embedding;
  }
}
