import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Agent } from "@/agent/agent";
import { GitRepository } from "@/git";
import { createLLM } from "@/llm/mod";
import { readConfig } from "@/config";
import { version } from "../../package.json";

export class AicaMcpServer {
  private server: McpServer;
  private agent: Agent;

  constructor(agent: Agent) {
    this.agent = agent;
    this.server = new McpServer({
      name: "aica-agent",
      version: version,
    });

    this.setupTools();
  }

  private setupTools() {
    // エージェントのタスク実行ツールを追加
    this.server.tool(
      "start_task",
      "Execute a task with the agent",
      {
        prompt: z.string().describe("The task prompt to execute"),
        maxIterations: z.number().optional().describe("Maximum number of iterations"),
        verbose: z.boolean().optional().describe("Enable verbose output"),
      },
      async ({ prompt, maxIterations = 25, verbose = false }) => {
        try {
          const messages = await this.agent.startTask(prompt, {
            maxIterations,
            verbose,
          });
          return {
            content: [{
              type: "text",
              text: messages.map((m) => `${m.role}: ${m.content}`).join("\n======\n"),
            }],
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error: ${error}` }],
            isError: true,
          };
        }
      }
    );
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

export async function startMcpServer(configPath?: string) {
  const config = await readConfig(configPath || null);
  const llm = createLLM(config.llm);
  const gitRepository = new GitRepository(process.cwd());
  await using agent = new Agent(gitRepository, llm, config, {
    consoleOutput: false,
  });
  const mcpServer = new AicaMcpServer(agent);
  await mcpServer.start();
}