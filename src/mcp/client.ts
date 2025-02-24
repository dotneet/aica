import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport";
import type { Resource, Tool } from "@modelcontextprotocol/sdk/types";
import { z } from "zod";

export const mcpItemSchema = z.discriminatedUnion("type", [
  z.object({
    name: z.string(),
    type: z.literal("stdio"),
    command: z.string(),
    args: z.array(z.string()),
  }),
  z.object({
    name: z.string(),
    type: z.literal("sse"),
    url: z.string(),
  }),
]);

export type MCPSetupItem = z.infer<typeof mcpItemSchema>;
export type MCPResource = {
  uri: string;
  mimeType?: string;
  blob?: Blob;
  text?: string;
};
export type MCPToolResult = {
  type: "text" | "image" | "resource";
  text?: string;
  data?: string;
  mimeType?: string;
};

function createToolPrompt(tool: Tool): string {
  return `<mcp_tool>
<name>${tool.name}</name>
<description>${tool.description}</description>
<json_schema>
${JSON.stringify(tool.inputSchema, null, 2)}
</json_schema>
</mcp_tool>`;
}

function createResourcePrompt(resource: Resource): string {
  return `<mcp_resource>
<name>${resource.name}</name>
<uri>${resource.uri}</uri>
<description>${resource.description}</description>
<mime_type>${resource.mimeType}</mime_type>
</mcp_resource>`;
}

export class MCPClient implements AsyncDisposable {
  private item: MCPSetupItem;
  private client: Client;
  private transport: Transport;
  private tools: Tool[];
  private resources: Resource[];

  constructor(item: MCPSetupItem) {
    this.item = item;
    this.tools = [];
    this.resources = [];
    this.client = new Client({
      name: this.item.name,
      version: "1.0.0",
    });
    this.transport = this.createTransport();
  }

  get name(): string {
    return this.item.name;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.transport.close();
    await this.client.close();
  }

  public async connect() {
    await this.client.connect(this.transport);
    await this.gatherServerInfo();
  }

  private createTransport(): Transport {
    if (this.item.type === "stdio") {
      return new StdioClientTransport({
        command: this.item.command,
        args: this.item.args,
      });
    }
    if (this.item.type === "sse") {
      return new SSEClientTransport(new URL(this.item.url));
    }
    throw new Error(`Invalid MCP setup item: ${JSON.stringify(this.item)}`);
  }

  private async gatherServerInfo(): Promise<void> {
    const capabilities = await this.client.getServerCapabilities();
    if (!capabilities) {
      return;
    }
    if (capabilities.tools) {
      const t = await this.client.listTools();
      this.tools.push(...t.tools);
    }
    if (capabilities.resources) {
      const r = await this.client.listResources();
      this.resources.push(...r.resources);
    }
  }

  public getInstructionPrompt(): string {
    return `
<mcp_server>
<name>${this.item.name}</name>
${this.tools.map((t) => createToolPrompt(t)).join("\n")}
${this.resources.map((r) => createResourcePrompt(r)).join("\n")}
</mcp_server>
`;
  }

  public async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<MCPToolResult[]> {
    const result = await this.client.callTool({
      name,
      arguments: args,
    });
    if (!result || !result.content) {
      throw new Error(`Tool call failed: ${name}`);
    }
    if (!Array.isArray(result.content)) {
      throw new Error(`Tool call result is not an array: ${name}`);
    }
    return result.content.map((c) => {
      return {
        type: c.type,
        text: c.text,
        data: c.data,
        mimeType: c.mimeType,
      };
    });
  }

  public async readResource(uri: string): Promise<MCPResource[]> {
    const r = await this.client.readResource({
      uri,
    });
    if (!r) {
      throw new Error(`Resource not found: ${uri}`);
    }
    return r.contents.map((c) => {
      return {
        uri: c.uri,
        mimeType: c.mimeType,
        blob: c.blob as Blob,
        text: c.text as string,
      };
    });
  }
}
