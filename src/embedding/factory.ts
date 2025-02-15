import { EmbeddingConfig } from "@/config";
import {
  EmbeddingProducer,
  EmbeddingProducerStub,
  OpenAIEmbeddingProducer,
} from "./embedding";

export function createEmbeddingProducer(
  settings: EmbeddingConfig,
): EmbeddingProducer {
  const { provider, openai } = settings;
  if (provider === "openai") {
    return new OpenAIEmbeddingProducer(openai.apiKey, openai.model);
  } else if (provider === "stub") {
    return new EmbeddingProducerStub();
  } else {
    throw new Error(`Unknown embedding provider: ${provider}`);
  }
}
