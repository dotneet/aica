import { Orama, create, insert, search } from "@orama/orama";
import { persist, restore } from "@orama/plugin-data-persistence";
import { Glob } from "bun";
import { EmbeddingProducer } from "@/embedding/mod";

import path from "node:path";
import fs from "node:fs";
import {
  extractDefinitionSymbols,
  extractReferenceSymbols,
} from "./extract-symbols";

export interface KnowledgeDatabase {
  populate(
    directory: string,
    includePatterns: string[],
    excludePatterns: string[],
  ): Promise<void>;
  reindex(): Promise<void>;
  insert(path: string, content: string): Promise<void>;
  search(
    content: string,
    limit: number,
  ): Promise<{ content: string; path: string }[]>;
  save(path: string): Promise<void>;
}

export class CodeSearchDatabaseOrama implements KnowledgeDatabase {
  static schema = {
    path: "string",
    content: "string",
    symbols: "string[]",
  } as const;

  constructor(
    private db: Orama<typeof CodeSearchDatabaseOrama.schema>,
    private persistentFilePath: string,
    private directory: string,
    private includePatterns: string[],
    private excludePatterns: string[],
    private embeddingProducer: EmbeddingProducer,
  ) {}

  static async create(
    persistentFilePath: string,
    directory: string,
    includePatterns: string[],
    excludePatterns: string[],
    embeddingProducer: EmbeddingProducer,
  ) {
    const db: Orama<typeof CodeSearchDatabaseOrama.schema> = await create({
      schema: CodeSearchDatabaseOrama.schema,
    });
    return new CodeSearchDatabaseOrama(
      db,
      persistentFilePath,
      directory,
      includePatterns,
      excludePatterns,
      embeddingProducer,
    );
  }

  static async load(
    persistentFilePath: string,
    directory: string,
    includePatterns: string[],
    excludePatterns: string[],
    embeddingProducer: EmbeddingProducer,
  ): Promise<CodeSearchDatabaseOrama> {
    const JSONIndex = fs.readFileSync(persistentFilePath, "utf8");
    const db: Orama<typeof CodeSearchDatabaseOrama.schema> = await restore(
      "json",
      JSONIndex,
    );
    return new CodeSearchDatabaseOrama(
      db,
      persistentFilePath,
      directory,
      includePatterns,
      excludePatterns,
      embeddingProducer,
    );
  }

  static async fromSettings(
    persistentFilePath: string,
    directory: string,
    includePatterns: string[],
    excludePatterns: string[],
    embeddingProducer: EmbeddingProducer,
  ): Promise<CodeSearchDatabaseOrama> {
    if (fs.existsSync(persistentFilePath)) {
      return await CodeSearchDatabaseOrama.load(
        persistentFilePath,
        directory,
        includePatterns,
        excludePatterns,
        embeddingProducer,
      );
    } else {
      const db = await CodeSearchDatabaseOrama.create(
        persistentFilePath,
        directory,
        includePatterns,
        excludePatterns,
        embeddingProducer,
      );
      await db.populate();
      if (persistentFilePath) {
        await db.save(persistentFilePath);
      } else {
        console.warn(
          "skip saving knowledge database due to the lack of persistentFilePath in the config.",
        );
      }
      return db;
    }
  }

  async populate(): Promise<void> {
    const excludeGlobs = this.excludePatterns.map(
      (pattern) => new Glob(pattern),
    );
    for (const includePattern of this.includePatterns) {
      const glob = new Glob(includePattern);
      for await (const file of glob.scan(this.directory)) {
        if (excludeGlobs.some((excludeGlob) => excludeGlob.match(file))) {
          continue;
        }
        const absPath = path.join(this.directory, file);
        await this.insert(absPath, fs.readFileSync(absPath, "utf8"));
      }
    }
  }

  async reindex(): Promise<void> {
    const db: Orama<typeof CodeSearchDatabaseOrama.schema> = await create({
      schema: CodeSearchDatabaseOrama.schema,
    });
    this.db = db;
    await this.populate();
    await this.save(this.persistentFilePath);
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
    limit: number = 5,
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
}

export class DocumentSearchDatabaseOrama implements KnowledgeDatabase {
  static schema = {
    path: "string",
    content: "string",
    embedding: "vector[1536]",
  } as const;

  constructor(
    private db: Orama<typeof DocumentSearchDatabaseOrama.schema>,
    private persistentFilePath: string,
    private directory: string,
    private includePatterns: string[],
    private excludePatterns: string[],
    private embeddingProducer: EmbeddingProducer,
  ) {}

  static async create(
    persistentFilePath: string,
    directory: string,
    includePatterns: string[],
    excludePatterns: string[],
    embeddingProducer: EmbeddingProducer,
  ) {
    const db: Orama<typeof DocumentSearchDatabaseOrama.schema> = await create({
      schema: DocumentSearchDatabaseOrama.schema,
    });
    return new DocumentSearchDatabaseOrama(
      db,
      persistentFilePath,
      directory,
      includePatterns,
      excludePatterns,
      embeddingProducer,
    );
  }

  static async load(
    persistentFilePath: string,
    directory: string,
    includePatterns: string[],
    excludePatterns: string[],
    embeddingProducer: EmbeddingProducer,
  ): Promise<DocumentSearchDatabaseOrama> {
    const JSONIndex = fs.readFileSync(persistentFilePath, "utf8");
    const db: Orama<typeof DocumentSearchDatabaseOrama.schema> = await restore(
      "json",
      JSONIndex,
    );
    return new DocumentSearchDatabaseOrama(
      db,
      persistentFilePath,
      directory,
      includePatterns,
      excludePatterns,
      embeddingProducer,
    );
  }

  static async fromSettings(
    persistentFilePath: string,
    directory: string,
    includePatterns: string[],
    excludePatterns: string[],
    embeddingProducer: EmbeddingProducer,
  ): Promise<DocumentSearchDatabaseOrama> {
    if (fs.existsSync(persistentFilePath)) {
      return await DocumentSearchDatabaseOrama.load(
        persistentFilePath,
        directory,
        includePatterns,
        excludePatterns,
        embeddingProducer,
      );
    } else {
      const db = await DocumentSearchDatabaseOrama.create(
        persistentFilePath,
        directory,
        includePatterns,
        excludePatterns,
        embeddingProducer,
      );
      await db.populate();
      if (persistentFilePath) {
        await db.save(persistentFilePath);
        console.warn(
          "skip saving knowledge database due to the lack of persistentFilePath in the config.",
        );
      }
      console.log("Knowledge database populated.");
      return db;
    }
  }

  async populate(): Promise<void> {
    const excludeGlobs = this.excludePatterns.map(
      (pattern) => new Glob(pattern),
    );
    for (const includePattern of this.includePatterns) {
      const glob = new Glob(includePattern);
      for await (const file of glob.scan(this.directory)) {
        if (excludeGlobs.some((excludeGlob) => excludeGlob.match(file))) {
          continue;
        }
        const absPath = path.join(this.directory, file);
        await this.insert(absPath, fs.readFileSync(absPath, "utf8"));
      }
    }
  }

  async reindex(): Promise<void> {
    const db: Orama<typeof DocumentSearchDatabaseOrama.schema> = await create({
      schema: DocumentSearchDatabaseOrama.schema,
    });
    this.db = db;
    await this.populate();
    await this.save(this.persistentFilePath);
  }

  async insert(path: string, content: string) {
    const embedding = await this.embeddingProducer.getEmbedding(content);
    await insert(this.db, {
      path: path,
      content: content,
      embedding: embedding,
    });
  }

  async search(
    content: string,
    limit: number = 3,
  ): Promise<{ content: string; path: string }[]> {
    const embedding: number[] = await this.embeddingProducer.getEmbedding(
      content,
    );
    const result = await search(this.db, {
      mode: "vector",
      vector: {
        value: embedding,
        property: "embedding",
      },
      similarity: 0.1,
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
}
