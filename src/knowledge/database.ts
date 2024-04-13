import { Orama, create, insert, search } from "@orama/orama";
import { persist, restore } from "@orama/plugin-data-persistence";
import { Glob } from "bun";
import { EmbeddingProducer } from "embedding";

import path from "node:path";
import fs from "node:fs";
import {
  extractDefinitionSymbols,
  extractReferenceSymbols,
} from "./extract-symbols";

const schema = {
  path: "string",
  content: "string",
  symbols: "string[]",
} as const;

export interface KnowledgeDatabase {
  populate(
    directory: string,
    includePatterns: string[],
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
    includePatterns: string[],
    excludePatterns: string[]
  ): Promise<void> {
    const excludeGlobs = excludePatterns.map((pattern) => new Glob(pattern));
    for (const includePattern of includePatterns) {
      const glob = new Glob(includePattern);
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
    const symbols = extractDefinitionSymbols(content);
    await insert(this.db, {
      path: path,
      content: content,
      symbols: symbols,
    });
  }

  async search(
    content: string,
    limit: number = 5
  ): Promise<{ content: string; path: string }[]> {
    const symbols = extractReferenceSymbols(content);
    const result = await search(this.db, {
      mode: "fulltext",
      term: symbols.join(" "),
      properties: ["symbols"],
      exact: false,
      limit: limit,
    });
    return result.hits.map((hit) => {
      let content = hit.document.content;
      if (content.length > 4000) {
        content = content.substring(0, 4000) + "...";
      }
      return {
        path: hit.document.path,
        content: content,
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
}
