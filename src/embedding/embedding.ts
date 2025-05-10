import {
  get_encoding,
  encoding_for_model,
  TiktokenModel,
  Tiktoken,
} from "tiktoken";

export interface EmbeddingProducer {
  getEmbedding(text: string): Promise<number[]>;
}

export class OpenAIEmbeddingProducer implements EmbeddingProducer {
  private readonly encoding: Tiktoken;

  constructor(
    private readonly openAiApiKey: string,
    private readonly embeddingModel: string,
  ) {
    this.encoding = encoding_for_model(this.embeddingModel as TiktokenModel);
    if (!this.openAiApiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    if (!this.embeddingModel) {
      throw new Error("EMBEDDING_MODEL is not set");
    }
  }

  async getEmbedding(text: string): Promise<number[]> {
    let targetText = text;
    let tokens = this.encoding.encode(targetText);
    while (tokens.length > 8192) {
      targetText = targetText.slice(0, targetText.length - 500);
      tokens = this.encoding.encode(targetText);
    }
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.openAiApiKey}`,
      },
      body: JSON.stringify({ model: this.embeddingModel, input: targetText }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get embedding: ${errorText}`);
    }
    const { data } = await response.json();
    return data[0].embedding;
  }
}

export class EmbeddingProducerStub implements EmbeddingProducer {
  async getEmbedding(text: string): Promise<number[]> {
    // return 1536-dimensional vector
    return Array(1536).fill(0);
  }
}
