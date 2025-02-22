import fs from "node:fs";
import { deepAssign } from "./utility/deep-assign";
import { GitRepository } from "./git";

export type LLMProvider = "openai" | "anthropic" | "stub" | "google";

export type LLMConfigOpenAI = {
  model: string;
  apiKey: string;
  temperature: number;
  maxCompletionTokens: number;
};

export type LLMConfigAnthropic = {
  model: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
};

export type LLMConfigGemini = {
  model: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
};

export type LLMConfig = {
  provider: LLMProvider;
  openai: LLMConfigOpenAI;
  anthropic: LLMConfigAnthropic;
  google: LLMConfigGemini;
  stub: {
    response: string;
  };
};

export type EmbeddingProvider = "openai" | "stub";

export type EmbeddingConfig = {
  provider: EmbeddingProvider;
  openai: {
    model: string;
    apiKey: string;
  };
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

export type LanguageConfig = {
  autoDetect: boolean;
  language: string;
};

export type Config = {
  workingDirectory: string;
  llm: LLMConfig;
  embedding: EmbeddingConfig;
  language: LanguageConfig;
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
  commitMessage: {
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

export const defaultConfig: Config = {
  workingDirectory: ".",
  llm: {
    provider: (Bun.env.AICA_LLM_PROVIDER as LLMProvider) || "openai",
    openai: {
      model: Bun.env.OPENAI_MODEL || "o3-mini",
      apiKey: Bun.env.OPENAI_API_KEY || "",
      temperature: 0.5,
      maxCompletionTokens: 4096,
    },
    anthropic: {
      model: Bun.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",
      apiKey: Bun.env.ANTHROPIC_API_KEY || "",
      temperature: 0.5,
      maxTokens: 4096,
    },
    google: {
      model: Bun.env.GOOGLE_MODEL || "gemini-2.0-flash",
      apiKey: Bun.env.GOOGLE_API_KEY || Bun.env.GEMINI_API_KEY || "",
      temperature: 0.5,
      maxTokens: 4096,
    },
    stub: {
      response: "",
    },
  },
  language: {
    autoDetect: true,
    language: "",
  },
  embedding: {
    provider: "openai",
    openai: {
      model: "text-embedding-3-small",
      apiKey: Bun.env.OPENAI_API_KEY || "",
    },
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
  commitMessage: {
    prompt: {
      system: "You are a senior software engineer.",
      rules: [
        "Generate one-line commit message based on given diff.",
        "Response must be less than 80 characters.",
      ],
      user: `Generate one-line commit message based on given diff.
        Use the prefix to describe the changes. Avialable prefixes: fix, feat, refactor, chore, test, docs, style, perf, ci, build, revert, merge, other
        Examples:
        - fix: fix the calculation logic
        - feat: add the new command
        - refactor: rename abc.txt to xyz.txt
        - chore: update the dependencies
        - test: add the test for the new command
        - docs: update readme
      `.replaceAll(/\n +/g, "\n"),
    },
  },
  source: {
    includePatterns: [
      "**/*.{js,ts,jsx,tsx,java,dart,kt,scala,go,rs,zig,rb,php,py,prisma,sql}",
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
      includePatterns: [
        "**/*.{txt,md,ts,tsx,js,jsx,scala,go,rb,php,py,prisma,sql}",
      ],
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

// Read a config file with the following priority:
// - the given path
// - current directory
// - git repository root
// - global config ($HOME/.config/aica/aica.toml)
export async function readConfig(
  configPath: string | null = null,
): Promise<Config> {
  let workingDirectory = ".";
  if (configPath) {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }
    workingDirectory = fs.realpathSync(configPath);
  } else {
    if (fs.existsSync("./aica.toml")) {
      configPath = "./aica.toml";
    }
    // search git repository root
    if (!configPath) {
      try {
        const cwd = process.cwd();
        const root = await GitRepository.getRepositoryRoot(cwd);
        const rootConfigPath = `${root}/aica.toml`;
        if (root) {
          workingDirectory = root;
          if (fs.existsSync(rootConfigPath)) {
            configPath = rootConfigPath;
          }
        }
      } catch (e) {
        // In github actions, some git features are not available as we don't have full access to the repository.
        console.warn("Failed to get git repository root, using default config");
      }
    }
    // search github actions config
    if (!configPath) {
      const cwd = process.cwd();
      const ghConfigPath = `${cwd}/aica.toml`;
      if (fs.existsSync(ghConfigPath)) {
        configPath = ghConfigPath;
      }
    }
    // search global config
    if (!configPath) {
      const home = Bun.env.HOME;
      if (!home) {
        throw new Error("HOME environment variable is not set");
      }
      const homeConfigPath = `${home}/.config/aica/aica.toml`;
      if (fs.existsSync(homeConfigPath)) {
        configPath = homeConfigPath;
      }
    }
  }

  if (!configPath) {
    console.warn("No config file found, using default config");
    return defaultConfig;
  }

  const file = fs.readFileSync(configPath);
  const config = Bun.TOML.parse(file.toString()) as Config;
  if (!config) {
    throw new Error(`Invalid config file: ${configPath}`);
  }
  return deepAssign(defaultConfig, config, { workingDirectory });
}
