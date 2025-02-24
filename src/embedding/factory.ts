import type { EmbeddingConfig } from "@/config";
import {
  type EmbeddingProducer,
  EmbeddingProducerStub,
  OpenAIEmbeddingProducer,
} from "./embedding";

export function createEmbeddingProducer(
  settings: EmbeddingConfig,
): EmbeddingProducer {
  const { provider, openai } = settings;
  if (provider === "openai") {
    return new OpenAIEmbeddingProducer(openai.apiKey, openai.model);
  }
  if (provider === "stub") {
    return new EmbeddingProducerStub();
  }
  throw new Error(`Unknown embedding provider: ${provider}`);
}
