import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync } from "node:fs";
import {
  createPatch,
  createPatchFromDiff,
  createRawPatch,
  createRawPatchFromString,
} from "@/agent/patch";
import { StdoutAgentConsole } from "../agent-console";
import {
  ToolError,
  type ToolExecutionContext,
  type ToolId,
  executeTool,
} from "./tool";
import { CreateFileTool } from "./tools/create-file";
import { EditFileTool } from "./tools/edit-file";
import { ListFilesTool } from "./tools/list-files";
import { ReadFileTool } from "./tools/read-file";
import { UseShellTool } from "./tools/use-shell";

describe("Tools", () => {
  const testFilePath = "./tmp/test.ts";
  const testDirPath = "./tmp/test-dir";
  const context: ToolExecutionContext = {
    mcpClientManager: null,
    addMessage: () => {},
    agentConsole: new StdoutAgentConsole(false),
  };

  beforeEach(async () => {
    try {
      await Bun.file(testFilePath).delete();
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
      await Bun.file(testFilePath).delete();
      if (existsSync(testDirPath)) {
        await Bun.spawn(["rm", "-rf", testDirPath]).exited;
      }
    } catch (e) {
      // Ignore if file/directory doesn't exist
    }
  });

  describe("CreateFileTool", () => {
    const tool = new CreateFileTool();

    it("should create a new file", async () => {
      const result = await tool.execute(context, {
        file: testFilePath,
        content: "",
      });
      expect(result.result).toBe(`Created file: ${testFilePath}`);
      const exists = await Bun.file(testFilePath).exists();
      expect(exists).toBe(true);
    });

    it("should throw error if file already exists", async () => {
      await Bun.write(testFilePath, "");
      await expect(
        tool.execute(context, { file: testFilePath, content: "" }),
      ).rejects.toThrow(`File ${testFilePath} already exists`);
    });

    it("should throw error if file path is not provided", async () => {
      await expect(
        tool.execute(context, {
          file: undefined as unknown as string,
          content: "",
        }),
      ).rejects.toThrow("File path is required");
    });
  });

  describe("EditFileTool", () => {
    const tool = new EditFileTool();

    it("should edit an existing file using patch", async () => {
      const oldContent = "const fielName = 'test.ts';\n";
      const newContent = "const fileName = 'test.ts';\n";
      await Bun.write(testFilePath, oldContent);

      const patch = await createRawPatchFromString(oldContent, newContent);
      const result = await tool.execute(context, {
        file: testFilePath,
        patch: patch,
      });

      expect(result.result).toContain(testFilePath);
      const content = await Bun.file(testFilePath).text();
      expect(content.replace(/\r\n/g, "\n")).toBe(newContent);
    });

    it("should throw error if file does not exist", async () => {
      const patch = await createRawPatchFromString("old", "new");
      await expect(
        tool.execute(context, { file: testFilePath, patch: patch }),
      ).rejects.toThrow(ToolError);
    });

    it("should throw error if patch is invalid", async () => {
      await Bun.write(testFilePath, "content");
      const invalidPatch = "This is not a valid patch at all";
      await expect(
        tool.execute(context, { file: testFilePath, patch: invalidPatch }),
      ).rejects.toThrow(ToolError);
    });
  });

  describe("ListFilesTool", () => {
    const tool = new ListFilesTool();

    it("should list files in directory", async () => {
      const testFiles = ["file1.txt", "file2.txt"];

      // Create test files
      for (const file of testFiles) {
        const filePath = `${testDirPath}/${file}`;
        await Bun.write(filePath, "test content");
      }

      const result = await tool.execute(context, { directory: testDirPath });

      // ファイルの順序は保証されないため、ソートして比較
      const resultFiles = result.result
        .replace(`Files in ${testDirPath}:\n`, "")
        .split("\n")
        .filter(Boolean);
      expect(resultFiles.sort()).toEqual(testFiles.sort());
    });

    it("should create directory if it does not exist", async () => {
      const newDir = "./tmp/new-dir";
      if (existsSync(newDir)) {
        await Bun.spawn(["rm", "-rf", newDir]).exited;
      }

      const result = await tool.execute(context, { directory: newDir });
      expect(result.result).toBe(`Files in ${newDir}:\n`);
      expect(existsSync(newDir)).toBe(true);

      // Cleanup
      await Bun.spawn(["rm", "-rf", newDir]).exited;
    });
  });

  describe("ReadFileTool", () => {
    const tool = new ReadFileTool();

    beforeEach(async () => {
      // 確実にファイルが存在しないことを確認
      if (existsSync(testFilePath)) {
        await Bun.file(testFilePath).delete();
      }
    });

    it("should read file content", async () => {
      const content = "test content";
      await Bun.write(testFilePath, content);

      const result = await tool.execute(context, { path: testFilePath });

      expect(result.result).toBe(`Read ${testFilePath}`);
      expect(result.addedFiles?.[0].content).toBe(content);
    });

    it("should return error message if file does not exist", async () => {
      const result = await tool.execute(context, { path: testFilePath });
      expect(result.result).toBe(`File ${testFilePath} does not exist`);
    });
  });

  describe("ExecuteCommandTool", () => {
    const tool = new UseShellTool();

    it("should execute shell command", async () => {
      let output = "";
      const originalLog = console.log;
      console.log = (message: string) => {
        output = message;
      };

      const result = await tool.execute(context, { command: "echo 'test'" });
      console.log = originalLog;

      expect(result.result).toContain("test");
      expect(output.trim()).toBe("test");
    });

    it("if command not found, return error message", async () => {
      const result = await tool.execute(context, {
        command: "nonexistent-command",
      });
      expect(result.result).toContain("Command failed with exit code");
    });
  });

  describe("executeTool", () => {
    const tools = {
      create_file: new CreateFileTool(),
    };

    it("should execute the correct tool and return result", async () => {
      const result = await executeTool(context, tools, {
        toolId: "create_file",
        params: { file: testFilePath, content: "" },
      });
      expect(result.result).toContain(testFilePath);
      const exists = await Bun.file(testFilePath).exists();
      expect(exists).toBe(true);
    });

    it("should throw error for unknown tool", async () => {
      await expect(
        executeTool(context, tools, {
          toolId: "unknown-tool" as ToolId,
          params: {},
        }),
      ).rejects.toThrow(ToolError);
    });
  });
});
