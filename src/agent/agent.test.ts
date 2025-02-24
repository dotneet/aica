import { Config, RulesConfig } from "@/config";
import { GitRepository } from "@/git";
import { createLLM } from "@/llm/mod";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync } from "node:fs";
import { Agent } from "./agent";
import { ActionBlock } from "./assistant-message";
import {
  executeTool,
  createToolExecutionContext,
  initializeTools,
} from "./tool/tool";

function createTestConfig(stubResponse: string = ""): Config {
  return {
    workingDirectory: process.cwd(),
    llm: {
      provider: "stub",
      openai: {
        model: "gpt-4",
        apiKey: "dummy",
        temperature: 0,
        maxCompletionTokens: 1000,
        logFile: undefined,
      },
      google: {
        model: "gemini-1.5-flash",
        apiKey: "dummy",
        temperature: 0,
        maxTokens: 1000,
        logFile: undefined,
      },
      anthropic: {
        model: "claude-3",
        apiKey: "dummy",
        temperature: 0,
        maxTokens: 1000,
        logFile: undefined,
      },
      stub: {
        response: stubResponse,
      },
    },
    embedding: {
      provider: "openai",
      openai: {
        model: "text-embedding-3-small",
        apiKey: "dummy",
      },
    },
    language: {
      language: "en",
    },
    rules: {
      files: [],
      findCursorRules: false,
    },
    mcp: {
      setupFile: "",
    },
    review: {
      prompt: {
        system: "",
        rules: [],
        user: "",
      },
    },
    summary: {
      prompt: {
        system: "",
        rules: [],
        user: "",
      },
    },
    commitMessage: {
      prompt: {
        system: "",
        rules: [],
        user: "",
      },
    },
    pullRequest: {
      withSummary: false,
      draft: false,
    },
    chat: {
      prompt: {
        system: "",
      },
    },
    source: {
      includePatterns: [],
      excludePatterns: [],
    },
  };
}

function createTestLLM(stubResponse: string) {
  return createLLM({
    provider: "stub",
    openai: {
      model: "gpt-4",
      apiKey: "dummy",
      temperature: 0,
      maxCompletionTokens: 1000,
      logFile: undefined,
    },
    google: {
      model: "gemini-1.5-flash",
      apiKey: "dummy",
      temperature: 0,
      maxTokens: 1000,
      logFile: undefined,
    },
    anthropic: {
      model: "claude-3",
      apiKey: "dummy",
      temperature: 0,
      maxTokens: 1000,
      logFile: undefined,
    },
    stub: {
      response: stubResponse,
    },
  });
}

describe("Agent", () => {
  const testFilePath = "./tmp/test.ts";
  const testDirPath = "./tmp/test-dir";
  const tools = initializeTools();
  const toolExecutionContext = createToolExecutionContext(null);

  beforeEach(async () => {
    try {
      if (existsSync(testFilePath)) {
        await Bun.file(testFilePath).delete();
      }
      if (existsSync(testDirPath)) {
        await Bun.spawn(["rm", "-rf", testDirPath]).exited;
      }
      mkdirSync(testDirPath, { recursive: true });
    } catch (e) {
      // Ignore if file/directory doesn't exist
    }
  });

  afterEach(async () => {
    try {
      if (existsSync(testFilePath)) {
        await Bun.file(testFilePath).delete();
      }
      if (existsSync(testDirPath)) {
        await Bun.spawn(["rm", "-rf", testDirPath]).exited;
      }
    } catch (e) {
      // Ignore if file/directory doesn't exist
    }
  });

  describe("plan", () => {
    it("should create a file", async () => {
      const stubResponse = `<create_file>
<file>${testFilePath}</file>
<content>
const fileName = 'test.ts';
</content>
</create_file>`;
      const llm = createTestLLM(stubResponse);
      const config = createTestConfig(stubResponse);
      const gitRepository = new GitRepository(process.cwd());
      const agent = new Agent(gitRepository, llm, config);
      const { blocks } = await agent.plan("create a test file");

      expect(blocks.length).toBe(1);
      const createFileAction = blocks[0];
      expect(createFileAction.type).toBe("action");
      expect((createFileAction as ActionBlock).action.toolId).toBe(
        "create_file",
      );
      expect((createFileAction as ActionBlock).action.params.file).toBe(
        testFilePath,
      );

      const result = await executeTool(
        toolExecutionContext,
        tools,
        (createFileAction as ActionBlock).action,
      );
      expect(result.result).toContain(testFilePath);
      expect(await Bun.file(testFilePath).exists()).toBe(true);
    });

    it("should edit a file", async () => {
      const oldContent = "const fielName = 'test.ts';\n";
      const newContent = "const fileName = 'test.ts';\n";
      await Bun.write(testFilePath, oldContent);

      const stubResponse = `<edit_file>
<file>${testFilePath}</file>
<patch>
--- ${testFilePath}
+++ ${testFilePath}
@@ -1,1 +1,1 @@
-const fielName = 'test.ts';
+const fileName = 'test.ts';
</patch>
</edit_file>`;
      const llm = createTestLLM(stubResponse);
      const config = createTestConfig(stubResponse);
      const gitRepository = new GitRepository(process.cwd());
      const agent = new Agent(gitRepository, llm, config);
      const { blocks } = await agent.plan("fix the typo in the file");

      expect(blocks.length).toBe(1);
      const editFileAction = blocks[0];
      expect(editFileAction.type).toBe("action");
      expect((editFileAction as ActionBlock).action.toolId).toBe("edit_file");
      expect((editFileAction as ActionBlock).action.params.file).toBe(
        testFilePath,
      );

      const result = await executeTool(
        toolExecutionContext,
        tools,
        (editFileAction as ActionBlock).action,
      );
      expect(result.result).toContain(testFilePath);
      const content = await Bun.file(testFilePath).text();
      expect(content.replace(/\r\n/g, "\n")).toBe(newContent);
    });
  });
});
