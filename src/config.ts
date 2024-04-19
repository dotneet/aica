import fs from "node:fs";
import { deepAssign } from "./utility/deep-assign";

export type LLMConfig = {
  provider: "openai";
  openai: {
    model: string;
    apiKey: string;
  };
  anthropic: {
    model: string;
    apiKey: string;
  };
};
export type EmbeddingConfig = {
  provider: "openai";
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

export type Config = {
  workingDirectory: string;
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

const defaultConfig: Config = {
  workingDirectory: ".",
  llm: {
    provider: "openai",
    openai: {
      model: Bun.env.OPENAI_MODEL || "gpt-4-turbo-2024-04-09",
      apiKey: Bun.env.OPENAI_API_KEY || "",
    },
    anthropic: {
      model: Bun.env.ANTHROPIC_MODEL || "claude-3-opus-20240229",
      apiKey: Bun.env.ANTHROPIC_API_KEY || "",
    },
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
      user: "Generate one-line commit message based on given diff.",
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

async function getGitRepositoryRoot(cwd: string): Promise<string | null> {
  const revParseResult = Bun.spawn({
    cmd: ["git", "rev-parse", "--show-toplevel"],
    cwd,
    stdout: "pipe",
  });
  const code = await revParseResult.exited;
  if (code !== 0) {
    return null;
  }
  const text = (await new Response(revParseResult.stdout).text()).trim();
  return text;
}

// Read a config file with the following priority:
// - the given path
// - current directory
// - git repository root
// - global config ($HOME/.config/aica/aica.toml)
export async function readConfig(path: string | null): Promise<Config> {
  let workingDirectory = ".";
  if (path) {
    if (!fs.existsSync(path)) {
      throw new Error(`Config file not found: ${path}`);
    }
    workingDirectory = fs.realpathSync(path);
  } else {
    if (!fs.existsSync("./aica.toml")) {
      const root = await getGitRepositoryRoot(process.cwd());
      if (root) {
        workingDirectory = root;
        path = `${root}/aica.toml`;
      } else {
        const home = Bun.env.HOME;
        if (!home) {
          throw new Error("HOME environment variable is not set");
        }
        path = `${home}/.config/aica/aica.toml`;
        if (!fs.existsSync(path)) {
          return defaultConfig;
        }
      }
    } else {
      path = "./aica.toml";
    }
  }
  const file = fs.readFileSync(path);
  const config = Bun.TOML.parse(file.toString()) as Config;
  if (!config) {
    throw new Error(`Invalid config file: ${path}`);
  }
  return deepAssign(defaultConfig, config, { workingDirectory });
}
