import {
  type Tool,
  ToolError,
  type ToolExecutionContext,
  type ToolExecutionResult,
  type ToolId,
} from "../tool";

export class UseShellTool implements Tool {
  name: ToolId = "use_shell";
  description =
    "Executes a shell command. This command can execute a command that does not mutate the file system. (args: command)";
  params = {
    command: {
      type: "string",
      description: "The shell command to execute",
    },
  };

  async execute(
    context: ToolExecutionContext,
    args: { command: string },
  ): Promise<ToolExecutionResult> {
    if (!args.command) {
      throw new ToolError("Command is required");
    }

    try {
      console.log("use_shell", args.command);
      const proc = Bun.spawn(["sh", "-c", args.command], {
        stdout: "pipe",
        stderr: "pipe",
      });
      await proc.exited;
      const output = await new Response(proc.stdout).text();
      const error = await new Response(proc.stderr).text();

      let result = "";
      if (error) {
        result += `Error: ${error}\n`;
      }
      if (output) {
        console.log(output);
        result += output;
      }

      const exitCode = await proc.exitCode;
      if (exitCode !== 0) {
        const exitCodeMessage = `Command failed with exit code ${exitCode}`;
        result += exitCodeMessage;
        return {
          result,
        };
      }
      return {
        result: `Command '${args.command}' successfully executed.\nOutput:\n${result}`,
      };
    } catch (error) {
      if (error instanceof ToolError) throw error;
      if (error instanceof Error) {
        throw new ToolError(`Failed to execute command: ${error.message}`);
      }
      throw new ToolError(`Failed to execute command: ${error}`);
    }
  }
}
