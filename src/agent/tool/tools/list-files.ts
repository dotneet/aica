import { Tool, ToolError, ToolExecutionResult, ToolId } from "../tool";
import { readdirSync, mkdirSync, existsSync } from "node:fs";

export class ListFilesTool implements Tool {
  name: ToolId = "list_files";
  description = "Lists files in a directory (args: directory?)";
  params = {
    directory: {
      type: "string",
      description:
        "The directory to list files from (optional, defaults to current directory)",
      optional: true,
    },
  };

  async execute(args: { directory?: string }): Promise<ToolExecutionResult> {
    const dir = args.directory || ".";
    try {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      const files = readdirSync(dir);
      return {
        result: `Files in ${dir}:\n${files.join("\n")}`,
      };
    } catch (error) {
      if (error instanceof ToolError) throw error;
      if (error instanceof Error) {
        throw new ToolError(`Failed to list files: ${error.message}`);
      } else {
        throw new ToolError(`Failed to list files: ${error}`);
      }
    }
  }
}
