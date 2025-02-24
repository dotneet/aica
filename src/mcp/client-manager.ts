import fs from "node:fs";
import { MCPClient, mcpItemSchema, MCPSetupItem } from "./client";

export class MCPClientManager implements AsyncDisposable {
  private items: MCPSetupItem[];
  private clients: MCPClient[];

  constructor(setupFilePath: string) {
    if (!fs.existsSync(setupFilePath)) {
      throw new Error(`MCP setup file not found: ${setupFilePath}`);
    }
    const setupContent = fs.readFileSync(setupFilePath, "utf-8");
    let mcpSchemaObject: object;
    try {
      mcpSchemaObject = JSON.parse(setupContent);
      if (!Array.isArray(mcpSchemaObject)) {
        throw new Error(`MCP setup file must be array: ${setupFilePath}.`);
      }
    } catch (error) {
      throw new Error(`Invalid MCP setup file: ${setupFilePath}`);
    }
    this.items = [];
    this.clients = [];
    for (const item of mcpSchemaObject) {
      try {
        const parsedItem = mcpItemSchema.parse(item);
        this.items.push(parsedItem);
      } catch (error) {
        throw new Error(
          `Invald MCP setup file: ${setupFilePath}\n${JSON.stringify(
            item,
          )}\n${error}`,
          { cause: error },
        );
      }
    }
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.stop();
  }

  async start(): Promise<void> {
    this.clients = [];
    for (const item of this.items) {
      const client = new MCPClient(item);
      await client.connect();
      this.clients.push(client);
    }
  }

  async stop(): Promise<void> {
    for (const client of this.clients) {
      try {
        await client[Symbol.asyncDispose]();
      } catch (error) {
        console.error(`Error disposing client: ${error}`);
      }
    }
  }

  /**
   * this function must be called after start()
   */
  getInstructionPrompt(): string {
    return this.clients.map((c) => c.getInstructionPrompt()).join("\n");
  }

  getClient(serverName: string): MCPClient | null {
    return this.clients.find((c) => c.name === serverName) ?? null;
  }
}
