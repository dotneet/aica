import fs from "node:fs";
import { deepAssign } from "./utility/deep-assign";

export type LLMConfig = {
  provider: "openai";
  model: string;
  embeddingModel: string;
  apiKey: string;
};
export type EmbeddingConfig = {
  provider: "openai";
  model: string;
  apiKey: string;
};

export type KnowledgeSearch = {
  directory: string;
  persistentFilePath: string;
  includePatterns: string[];
  excludePatterns: string[];
};

export type Knowledge = {
  fixture?: {
    files: string[];
  };
  codeSearch?: KnowledgeSearch;
  documentSearch?: KnowledgeSearch;
};

export type Config = {
  llm: LLMConfig;
  embedding: EmbeddingConfig;
  knowledge?: Knowledge;
  review: {
    prompt: {
      system: string;
      rules: string[];
      user: string;
    };
  };
  summary: {
    prompt: {
      system: string;
      rules: string[];
      user: string;
    };
  };
  source: {
    includePatterns: string[];
    excludePatterns: string[];
  };
};

const defaultConfig: Config = {
  llm: {
    provider: "openai",
    model: Bun.env.OPENAI_MODEL || "gpt-4-turbo-2024-04-09",
    embeddingModel: "text-embedding-3-small",
    apiKey: Bun.env.OPENAI_API_KEY || "",
  },
  embedding: {
    provider: "openai",
    model: "text-embedding-3-small",
    apiKey: Bun.env.OPENAI_API_KEY || "",
  },
  review: {
    prompt: {
      system: "You are a QA engineer reviewing code for bugs.",
      rules: [
        "Provide list of critical or high risk bugs and security issues.",
        "Use JSON format to return the issues.",
        "Only provide when you are convinced that it is a bug absolutely.",
        "No need to output low risk bugs and error handling problems.",
        "Provide up to 5 issues.",
      ],
      user: "Identify and list any critical bugs in the code below, with brief explanations for each.",
    },
  },
  summary: {
    prompt: {
      system: "You are a senior software engineer.",
      rules: [
        "Provide list of the brief summary of the changes in the given code.",
        "Given code maybe a diff or a code snippet.",
        "Use JSON format to return the explanation of changes.",
      ],
      user: "Summarize the given code changes.\n\n=== CODE ===\n%CODE%\n=========",
    },
  },
  source: {
    includePatterns: [
      "**/*.{js,ts,jsx,tsx,java,dart,kt,scala,go,rs,zig,rb,php,py}",
    ],
    excludePatterns: [
      "node_modules/**",
      "vendor/**",
      "tmp/**",
      "dist/**",
      "out/**",
      "test/**",
      "tests/**",
      "spec/**",
      "specs/**",
      "**.test.ts",
    ],
  },
  knowledge: {
    fixture: {
      files: [],
    },
    codeSearch: {
      directory: "",
      persistentFilePath: "./knowledge-src.db",
      includePatterns: ["**/*.{txt,md,ts,tsx,js,jsx,scala,go,rb,php,py}"],
      excludePatterns: [
        "node_modules/**",
        "vendor/**",
        "tmp/**",
        "dist/**",
        "out/**",
      ],
    },
    documentSearch: {
      directory: "",
      persistentFilePath: "./knowledge-docs.db",
      includePatterns: ["**/*.{txt,md,html,adoc}"],
      excludePatterns: [
        "node_modules/**",
        "vendor/**",
        "tmp/**",
        "dist/**",
        "out/**",
      ],
    },
  },
};

export function readConfig(path: string | null): Config {
  if (path) {
    if (!fs.existsSync(path)) {
      throw new Error(`Config file not found: ${path}`);
    }
  } else {
    if (!fs.existsSync("./aica.toml")) {
      return defaultConfig;
    }
    path = "./aica.toml";
  }
  const file = fs.readFileSync(path);
  const config = Bun.TOML.parse(file.toString()) as Config;
  return deepAssign(defaultConfig, config);
}
