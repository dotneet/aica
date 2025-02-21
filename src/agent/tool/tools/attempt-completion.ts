import { Tool, ToolError, ToolExecutionResult, ToolId } from "../tool";

export class AttemptCompletionTool implements Tool {
  name: ToolId = "attempt_completion";
  description =
    "Once you've completed the task, use this tool to present the result to the user. They may respond with feedback if they are not satisfied with the result, which you can use to make improvements and try again.";
  params = {
    result: {
      type: "string",
      description:
        "(required) The result of the task. Formulate this result in a way that is final and does not require further input from the user. Don't end your result with questions or offers for further assistance.",
    },
    command: {
      type: "string",
      description:
        "(optional) A CLI command to execute to show a live demo of the result to the user. For example, use `open index.html` to display a created html website, or `open localhost:3000` to display a locally running development server. But DO NOT use commands like `echo` or `cat` that merely print text. This command should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions.",
    },
  };
  example = `
<attempt_completion>
<result>The task is complete.</result>
<command>open index.html</command>
</attempt_completion>
`;

  async execute(args: {
    result: string;
    command: string;
  }): Promise<ToolExecutionResult> {
    if (!args.result) {
      throw new ToolError("Result is required");
    }

    try {
      console.log(args.result);
      if (args.command) {
        const proc = Bun.spawn([args.command], {
          stdout: "pipe",
          stderr: "pipe",
        });
        await proc.exited;
        const error = await proc.stderr;
        if (proc.exitCode !== 0) {
          return {
            result: `Command '${args.command}' failed with exit code ${proc.exitCode}.\nError: ${error}`,
          };
        }
      }
      return {
        result: args.result,
      };
    } catch (error) {
      if (error instanceof ToolError) throw error;
      throw new ToolError(`Failed to generate completion: ${error.message}`);
    }
  }
}
