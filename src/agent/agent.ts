import type { Config, RulesConfig } from "@/config";
import type { GitRepository } from "@/git";
import type { LLM, Message } from "@/llm/mod";
import { getEnvironmentDetailsPrompt } from "@/llmcontext/system-environment";
import { MCPClientManager } from "@/mcp/client-manager";
import type { Source } from "@/source";
import { AgentHistory } from "./agent-history";
import { type MessageBlock, parseAssistantMessage } from "./assistant-message";
import { getSystemPrompt } from "./prompt/system-prompt";
import {
  type ActionResult,
  type Tool,
  type ToolExecutionContext,
  createToolExecutionContext,
  executeTool,
  generateAvailableTools,
  initializeTools,
} from "./tool/mod";

export type TaskExecutionOptions = {
  verbose: boolean;
  maxIterations: number;
};
const defaultTaskExecutionOptions: TaskExecutionOptions = {
  maxIterations: 10,
  verbose: false,
};

export type PlanResult = {
  blocks: MessageBlock[];
  response: string;
};

export class Agent implements AsyncDisposable {
  private gitRepository: GitRepository;
  private llm: LLM;
  private rulesConfig: RulesConfig;
  private history: AgentHistory;
  private messages: Message[] = [];
  private referencedFiles: Map<string, Source> = new Map();
  private mcpClientManager: MCPClientManager | null = null;
  private tools: Record<string, Tool>;
  private toolExecutionContext: ToolExecutionContext;

  constructor(gitRepository: GitRepository, llm: LLM, config: Config) {
    this.tools = initializeTools();
    this.rulesConfig = config.rules;
    this.gitRepository = gitRepository;
    this.llm = llm;
    this.history = new AgentHistory();
    this.messages = [];
    this.messages.push({
      role: "user",
      content: getEnvironmentDetailsPrompt(process.cwd()),
    });

    if (config.mcp.setupFile) {
      this.mcpClientManager = new MCPClientManager(config.mcp.setupFile);
    }
    this.toolExecutionContext = createToolExecutionContext(
      this.mcpClientManager,
    );
    this.start();
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }

  private async start(): Promise<void> {
    if (this.mcpClientManager) {
      await this.mcpClientManager.start();
    }
  }

  async close(): Promise<void> {
    if (this.mcpClientManager) {
      await this.mcpClientManager.stop();
    }
  }

  async plan(prompt: string): Promise<PlanResult> {
    const systemPrompt = await this.createSystemPrompt();
    const messages: Message[] = [
      ...this.messages,
      { role: "user", content: prompt },
    ];
    const response = await this.llm.generate(systemPrompt, messages, false);
    this.messages = messages;
    return {
      blocks: parseAssistantMessage(response),
      response: response,
    };
  }

  addActionResult(actionResult: ActionResult) {
    this.messages.push({
      role: "assistant",
      content: actionResult.result,
    });
  }

  addFile(file: Source) {
    this.referencedFiles.set(file.path, file);
  }

  private async createSystemPrompt(): Promise<string> {
    let mcpPrompt = "=== Available MCP Servers ===\n";
    if (this.mcpClientManager) {
      mcpPrompt +=
        "You can use the MCP server tool and resource using use_mcp_tool and use_mcp_resource.";
      mcpPrompt += this.mcpClientManager.getInstructionPrompt();
    } else {
      mcpPrompt +=
        "No MCP servers are available. You can not use use_mcp_tool and use_mcp_resource.";
    }
    const prompt = await getSystemPrompt(
      process.cwd(),
      this.rulesConfig,
      this.gitRepository.gitRootDir,
      generateAvailableTools(this.tools),
      mcpPrompt,
      this.history.toPromptString(),
      this.referencedFiles,
    );

    return prompt;
  }

  async startTask(
    initialPrompt: string,
    taskOptions: Partial<TaskExecutionOptions> = {},
  ): Promise<void> {
    const options = { ...defaultTaskExecutionOptions, ...taskOptions };
    const maxIterations =
      options.maxIterations ?? defaultTaskExecutionOptions.maxIterations;
    let iterations = 0;
    let stopped = false;
    let prompt = `<task>\n${initialPrompt}\n</task>`;
    while (!stopped) {
      if (iterations > maxIterations) {
        console.warn(`Max iterations(${maxIterations}) reached`);
        break;
      }
      iterations++;

      const { blocks, response } = await this.plan(prompt);
      this.messages.push({
        role: "assistant",
        content: response,
      });
      let hasActionResult = false;
      const hasMultipleActions =
        blocks.filter((b) => b.type === "action").length > 1;
      if (hasMultipleActions) {
        console.warn(
          "Multiple tool usage detected. Proceeding to find next action...",
        );
        prompt =
          "Multiple tools cannot be used simultaneously. Please review the task and recent messages again.";
        continue;
      }

      for (const block of blocks) {
        if (block.type === "plain") {
          console.log(block.content);
        } else if (block.type === "action") {
          if (block.action.toolId !== "attempt_completion" || options.verbose) {
            console.log(
              `Executing action: ${
                block.action.toolId
              } Params: ${JSON.stringify(block.action.params, null, 2)}`,
            );
          }
          const toolExecutionResult = await executeTool(
            this.toolExecutionContext,
            this.tools,
            block.action,
          );
          if (toolExecutionResult.addedFiles) {
            for (const file of toolExecutionResult.addedFiles) {
              this.addFile(file);
            }
          }
          const actionResult = {
            action: block.action,
            result: toolExecutionResult.result,
          };
          this.addActionResult(actionResult);
          hasActionResult = true;

          if (block.action.toolId === "attempt_completion") {
            stopped = true;
            break;
          }
        }
      }
      if (!hasActionResult) {
        console.warn("No action found. agent will stop.");
        break;
      }
      prompt =
        "Please evaluate the task content and the tool's execution results. Only consider the next action if it is necessary to continue the task.";
    }
  }
}
