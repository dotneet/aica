import { Orama, create, insert, searchVector } from "@orama/orama";
import { persist, restore } from "@orama/plugin-data-persistence";
import { Glob } from "bun";
import { EmbeddingProducer } from "embedding";

import path from "node:path";
import fs from "node:fs";

const schema = {
  path: "string",
  content: "string",
  embedding: "vector[1536]",
} as const;

export interface KnowledgeDatabase {
  populate(
    directory: string,
    globPatterns: string[],
    excludePatterns: string[]
  ): Promise<void>;
  insert(path: string, content: string): Promise<void>;
  search(
    content: string,
    limit: number
  ): Promise<{ content: string; path: string }[]>;
  save(path: string): Promise<void>;
}

export class KnowledgeDatabaseOrama implements KnowledgeDatabase {
  constructor(
    private db: Orama<typeof schema>,
    private embeddingProducer: EmbeddingProducer
  ) {}

  static async create(embeddingProducer: EmbeddingProducer) {
    const db: Orama<typeof schema> = await create({
      schema: schema,
    });
    return new KnowledgeDatabaseOrama(db, embeddingProducer);
  }

  async populate(
    directory: string,
    globPatterns: string[],
    excludePatterns: string[]
  ): Promise<void> {
    const excludeGlobs = excludePatterns.map((pattern) => new Glob(pattern));
    for (const globPattern of globPatterns) {
      const glob = new Glob(globPattern);
      for await (const file of glob.scan(directory)) {
        if (excludeGlobs.some((excludeGlob) => excludeGlob.match(file))) {
          continue;
        }
        const absPath = path.join(directory, file);
        await this.insert(absPath, fs.readFileSync(absPath, "utf8"));
      }
    }
  }

  async insert(path: string, content: string) {
    const chunks = this.splitIntoChunks(content);
    for (const chunk of chunks) {
      const embedding = await this.embeddingProducer.getEmbedding(chunk);
      await insert(this.db, {
        path: path,
        content: chunk,
        embedding: embedding,
      });
    }
  }

  async search(
    content: string,
    limit: number = 5
  ): Promise<{ content: string; path: string }[]> {
    const vector = await this.embeddingProducer.getEmbedding(content);
    const result = await searchVector(this.db, {
      mode: "vector",
      vector: {
        value: vector,
        property: "embedding",
      },
      similarity: 0.01,
      limit: limit,
    });
    return result.hits.map((hit) => {
      return {
        path: hit.document.path,
        content: hit.document.content,
      };
    });
  }

  async save(path: string) {
    const JSONIndex = await persist(this.db, "json");
    fs.writeFileSync(path, JSONIndex);
  }

  static async load(
    path: string,
    embeddingProducer: EmbeddingProducer
  ): Promise<KnowledgeDatabaseOrama> {
    const JSONIndex = fs.readFileSync(path, "utf8");
    const db: Orama<typeof schema> = await restore("json", JSONIndex);
    return new KnowledgeDatabaseOrama(db, embeddingProducer);
  }

  private splitIntoChunks(text: string): string[] {
    const blocks = text.split(/\n\n+/);
    const chunks: string[] = [];
    const chunkSize = 200;
    let sumLines = 0;
    let chunk = "";
    for (const block of blocks) {
      const lines = block.split(/\n+/);
      sumLines += lines.length;
      chunk += block + "\n\n";
      if (sumLines > chunkSize) {
        chunks.push(chunk);
        chunk = "";
        sumLines = 0;
      }
    }
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    return chunks;
  }
}
