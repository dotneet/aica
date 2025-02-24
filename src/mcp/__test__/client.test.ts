import { beforeEach, describe, expect, mock, test } from "bun:test";
import { join } from "node:path";
import { MCPClient, type MCPSetupItem } from "../client";

// モックの実装
const mockTransport = {
  close: () => Promise.resolve(),
  send: () => Promise.resolve(),
  onMessage: () => {},
  onClose: () => {},
};

const mockClientImplementation = {
  connect: () => Promise.resolve(),
  close: () => Promise.resolve(),
  getServerCapabilities: () =>
    Promise.resolve({ tools: true, resources: true }),
  listTools: () => Promise.resolve({ tools: [{ name: "test-tool" }] }),
  listResources: () =>
    Promise.resolve({ resources: [{ uri: "test://resource" }] }),
  callTool: () =>
    Promise.resolve({
      content: [
        {
          type: "text",
          text: "Received arg: test-value",
          mimeType: "text/plain",
        },
      ],
    }),
  readResource: () =>
    Promise.resolve({
      contents: [
        {
          uri: "test://resource",
          text: "Test resource content",
          mimeType: "text/plain",
        },
      ],
    }),
};

describe("MCPClient", () => {
  describe("With Mocked Transport", () => {
    beforeEach(() => {
      // トランスポートのモック
      mock.module("@modelcontextprotocol/sdk/client/sse.js", () => ({
        SSEClientTransport: class {
          constructor() {
            Object.assign(this, mockTransport);
          }
        },
      }));

      mock.module("@modelcontextprotocol/sdk/client/stdio.js", () => ({
        StdioClientTransport: class {
          constructor() {
            Object.assign(this, mockTransport);
          }
        },
      }));

      // Clientのモック
      mock.module("@modelcontextprotocol/sdk/client/index.js", () => ({
        Client: class {
          constructor() {
            Object.assign(this, mockClientImplementation);
          }
        },
      }));
    });

    describe("SSE Transport", () => {
      const sseSetup: MCPSetupItem = {
        name: "test-sse",
        type: "sse",
        url: "http://localhost:3000/sse",
      };

      test("should connect and gather server info", async () => {
        const client = new MCPClient(sseSetup);
        await client.connect();
        await client[Symbol.asyncDispose]();
      });

      test("should call tool", async () => {
        const client = new MCPClient(sseSetup);
        await client.connect();

        const result = await client.callTool("test-tool", {
          arg: "test-value",
        });
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe("text");
        expect(result[0].text).toBe("Received arg: test-value");

        await client[Symbol.asyncDispose]();
      });

      test("should read resource", async () => {
        const client = new MCPClient(sseSetup);
        await client.connect();

        const result = await client.readResource("test://resource");
        expect(result).toHaveLength(1);
        expect(result[0].uri).toBe("test://resource");
        expect(result[0].text).toBe("Test resource content");

        await client[Symbol.asyncDispose]();
      });
    });

    describe("Stdio Transport", () => {
      const stdioSetup: MCPSetupItem = {
        name: "test-stdio",
        type: "stdio",
        command: "echo",
        args: ["test"],
      };

      test("should connect with stdio transport", async () => {
        const client = new MCPClient(stdioSetup);
        await client.connect();
        await client[Symbol.asyncDispose]();
      });
    });
  });

  describe("With Real Stdio Server", () => {
    const stdioSetup: MCPSetupItem = {
      name: "test-stdio",
      type: "stdio",
      command: "bun",
      args: [
        "run",
        join(
          process.cwd(),
          "src/mcp/__test__/fixtures",
          "test-stdio-server.js",
        ),
      ],
    };

    test("should connect to real server", async () => {
      const client = new MCPClient(stdioSetup);
      await client.connect();
      await client[Symbol.asyncDispose]();
    });

    test("should call tool on real server", async () => {
      const client = new MCPClient(stdioSetup);
      await client.connect();

      const result = await client.callTool("test-tool", { arg: "test-value" });
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("text");
      expect(result[0].text).toBe("Received arg: test-value");

      await client[Symbol.asyncDispose]();
    });

    test("should read resource from real server", async () => {
      const client = new MCPClient(stdioSetup);
      await client.connect();

      const result = await client.readResource("test://resource");
      expect(result).toHaveLength(1);
      expect(result[0].uri).toBe("test://resource");
      expect(result[0].text).toBe("Test resource content");

      await client[Symbol.asyncDispose]();
    });
  });
});
