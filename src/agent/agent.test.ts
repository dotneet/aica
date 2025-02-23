import { createLLM } from "@/llm/mod";
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Agent } from "./agent";
import { createPatch } from "./patch";
import { mkdirSync, existsSync } from "node:fs";
import { GitRepository } from "@/git";
import { ActionBlock } from "./assistant-message";
import { executeTool } from "./tool/tool";

describe("Agent", () => {
  const testFilePath = "./tmp/test.ts";
  const testDirPath = "./tmp/test-dir";

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
      const llm = createLLM({
        provider: "stub",
        openai: {
          model: "gpt-4",
          apiKey: "dummy",
        },
        anthropic: {
          model: "claude-3",
          apiKey: "dummy",
        },
        stub: {
          response: `<create_file>
<file>${testFilePath}</file>
<content>
const fileName = 'test.ts';
</content>
</create_file>`,
        },
      });

      const gitRepository = new GitRepository(process.cwd());
      const agent = new Agent(gitRepository, llm);
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
        (createFileAction as ActionBlock).action,
      );
      expect(result.result).toContain(testFilePath);
      expect(await Bun.file(testFilePath).exists()).toBe(true);
    });

    it("should edit a file", async () => {
      const oldContent = "const fielName = 'test.ts';";
      const newContent = "const fileName = 'test.ts';";
      await Bun.write(testFilePath, oldContent);

      const llm = createLLM({
        provider: "stub",
        openai: {
          model: "gpt-4",
          apiKey: "dummy",
        },
        anthropic: {
          model: "claude-3",
          apiKey: "dummy",
        },
        stub: {
          response: `<edit_file>
<file>${testFilePath}</file>
<patch>
--- hoge.ts
+++ hoge.ts
@@ -1,3 +1,3 @@
-const fielName = 'test.ts';
+const fileName = 'test.ts';
</patch>
</edit_file>`,
        },
      });

      const gitRepository = new GitRepository(process.cwd());
      const agent = new Agent(gitRepository, llm);
      const { blocks } = await agent.plan("fix a typo in the test file");

      expect(blocks.length).toBe(1);
      const editFileAction = blocks[0];
      expect(editFileAction.type).toBe("action");
      expect((editFileAction as ActionBlock).action.toolId).toBe("edit_file");
      expect((editFileAction as ActionBlock).action.params.file).toBe(
        testFilePath,
      );
      expect((editFileAction as ActionBlock).action.params.patch).toBeDefined();

      const result = await executeTool((editFileAction as ActionBlock).action);
      expect(result.result).toContain(testFilePath);

      const content = await Bun.file(testFilePath).text();
      expect(content).toBe(newContent);
    });
  });
});
