import { EmbeddingConfig } from "@/config";
import { EmbeddingProducer } from "./embedding";

export function createEmbeddingProducer(settings: EmbeddingConfig) {
  const { provider, openai } = settings;
  if (provider === "openai") {
    return new EmbeddingProducer(openai.model, openai.apiKey);
  } else {
    throw new Error(`Unknown embedding provider: ${provider}`);
  }
}
