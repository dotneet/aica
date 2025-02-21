import { Tool, ToolError, ToolExecutionResult, ToolId } from "../tool";
import { Source } from "@/source";

export class ReadFileTool implements Tool {
  name: ToolId = "read_file";
  description = "Reads the content of a file (args: file)";
  params = {
    file: {
      type: "string",
      description: "The path of the file to read",
    },
  };

  async execute(args: { file: string }): Promise<ToolExecutionResult> {
    if (!args.file) {
      throw new ToolError("File path is required");
    }

    try {
      const file = Bun.file(args.file);
      if (!(await file.exists())) {
        return {
          result: `File ${args.file} does not exist`,
        };
      }
      const content = await file.text();
      const src = Source.fromText(args.file, content);
      return {
        result: `readed ${src.path}`,
        addedFiles: [src],
      };
    } catch (error) {
      if (error instanceof ToolError) throw error;
      throw new ToolError(`Failed to read file: ${error.message}`);
    }
  }
}
