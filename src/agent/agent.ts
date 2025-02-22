import { GitRepository } from "@/git";
import { LLM, Message } from "@/llm/mod";
import { AgentHistory } from "./agent-history";
import { MessageBlock, parseAssistantMessage } from "./assistant-message";
import { getSystemPrompt } from "./prompt/system-prompt";
import { ActionResult, executeTool, generateAvailableTools } from "./tool/mod";
import { Source } from "@/source";
import { getEnvironmentDetailsPrompt } from "./prompt/user-prompt";

export type TaskExecutionOptions = {
  verbose: boolean;
  maxIterations: number;
};
const defaultTaskExecutionOptions: TaskExecutionOptions = {
  maxIterations: 10,
  verbose: false,
};

export class Agent {
  private gitRepository: GitRepository;
  private llm: LLM;
  private history: AgentHistory;
  private messages: Message[] = [];
  private referencedFiles: Map<string, Source> = new Map();

  constructor(gitRepository: GitRepository, llm: LLM) {
    this.gitRepository = gitRepository;
    this.llm = llm;
    this.history = new AgentHistory();
    this.messages = [];
    this.messages.push({
      role: "user",
      content: getEnvironmentDetailsPrompt(process.cwd()),
    });
  }

  async plan(prompt: string): Promise<MessageBlock[]> {
    const systemPrompt = this.createSystemPrompt();
    const messages: Message[] = [
      ...this.messages,
      { role: "user", content: prompt },
    ];
    const response = await this.llm.generate(systemPrompt, messages, false);
    this.messages = messages;
    return parseAssistantMessage(response);
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
    const maxIterations =
      options.maxIterations ?? defaultTaskExecutionOptions.maxIterations;
    let iterations = 0;
    let stopped = false;
    while (!stopped) {
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
          if (block.action.toolId === "stop") {
            stopped = true;
            break;
          }
          if (block.action.toolId !== "attempt_completion" || options.verbose) {
            console.log(
              `Executing action: ${
                block.action.toolId
              } Params: ${JSON.stringify(block.action.params, null, 2)}`,
            );
          }
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
        }
      }
      prompt =
        "If the task has been completed, return stop command. Otherwise, consider next action.";
    }
  }
}
