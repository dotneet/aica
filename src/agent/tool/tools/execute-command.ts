import { Tool, ToolError, ToolExecutionResult, ToolId } from "../tool";

export class ExecuteCommandTool implements Tool {
  name: ToolId = "execute_command";
  description =
    "Executes a shell command. This command can execute a command that does not mutate the file system. (args: command)";
  params = {
    command: {
      type: "string",
      description: "The shell command to execute",
    },
  };

  async execute(args: { command: string }): Promise<ToolExecutionResult> {
    if (!args.command) {
      throw new ToolError("Command is required");
    }

    try {
      console.log("execute_command", args.command);
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
      throw new ToolError(`Failed to execute command: ${error.message}`);
    }
  }
}
