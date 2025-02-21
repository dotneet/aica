import { GitRepository } from "@/git";
import { LLM } from "@/llm/mod";
import { AgentHistory } from "./agent-history";
import { MessageBlock, parseAssistantMessage } from "./assistant-message";
import { getSystemPrompt } from "./prompt/prompt";
import { ActionResult, executeTool, generateAvailableTools } from "./tool/mod";
import { Source } from "@/source";

export type TaskExecutionOptions = {
  maxIterations?: number;
};
const defaultTaskExecutionOptions: TaskExecutionOptions = {
  maxIterations: 10,
};

export class Agent {
  private gitRepository: GitRepository;
  private llm: LLM;
  private history: AgentHistory;
  private referencedFiles: Map<string, Source> = new Map();

  constructor(gitRepository: GitRepository, llm: LLM) {
    this.gitRepository = gitRepository;
    this.llm = llm;
    this.history = new AgentHistory();
  }

  async plan(prompt: string): Promise<MessageBlock[]> {
    const systemPrompt = this.createSystemPrompt();
    const response = await this.llm.generate(systemPrompt, prompt, false);
    this.history.addUserPrompt(prompt);
    return parseAssistantMessage(response);
  }

  addActionResult(actionResult: ActionResult) {
    this.history.addActionResult(actionResult);
  }

  addFile(file: Source) {
    this.referencedFiles.set(file.path, file);
  }

  private createSystemPrompt(): string {
    return getSystemPrompt(
      process.cwd(),
      this.gitRepository.gitRootDir,
      generateAvailableTools(),
      this.history.toPromptString(),
      this.referencedFiles,
    );
  }

  async startTask(
    prompt: string,
    options: Partial<TaskExecutionOptions> = {},
  ): Promise<void> {
    options = { ...defaultTaskExecutionOptions, ...options };
    const maxIterations = options.maxIterations;
    let iterations = 0;
    while (true) {
      if (iterations > maxIterations) {
        console.warn(`Max iterations(${maxIterations}) reached`);
        break;
      }
      iterations++;

      const blocks = await this.plan(prompt);
      for (const block of blocks) {
        if (block.type === "plain") {
          console.log(block.content);
        } else if (block.type === "action") {
          console.log(
            `Executing action: ${block.action.toolId} Params: ${JSON.stringify(
              block.action.params,
              null,
              2,
            )}`,
          );
          const toolExecutionResult = await executeTool(block.action);
          if (toolExecutionResult.addedFiles) {
            toolExecutionResult.addedFiles.forEach((file) =>
              this.addFile(file),
            );
          }
          const actionResult = {
            action: block.action,
            result: toolExecutionResult.result,
          };
          this.addActionResult(actionResult);
          if (actionResult.action.toolId === "stop") {
            return;
          }
        }
      }
      prompt =
        "Consider next action. If the task is done, return stop command.";
    }
  }
}
