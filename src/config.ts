import fs from "node:fs";

export type LLMSettings = {
  model: string;
  embeddingModel: string;
  openAiApiKey: string;
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
  search?: KnowledgeSearch;
};

interface Config {
  llm: LLMSettings;
  knowledge?: Knowledge;
  prompt: {
    system: string;
    rules: string[];
    user: string;
  };
  source: {
    suffixes: string[];
    excludePatterns: string[];
  };
}

const defaultConfig: Config = {
  llm: {
    model: Bun.env.OPENAI_MODEL || "gpt-4-turbo-2024-04-09",
    embeddingModel: "text-embedding-3-small",
    openAiApiKey: Bun.env.OPENAI_API_KEY || "",
  },
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
  source: {
    suffixes: [
      ".js",
      ".ts",
      ".jsx",
      ".tsx",
      ".scala",
      ".go",
      ".rb",
      ".php",
      ".py",
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
    search: {
      directory: "",
      persistentFilePath: "./knowledge.db",
      includePatterns: ["**/*.{txt,md,ts,tsx,js,jsx,scala,go,rb,php,py}"],
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
  return {
    ...defaultConfig,
    ...config,
  };
}
