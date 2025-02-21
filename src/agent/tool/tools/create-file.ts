import { Source } from "@/source";
import { Tool, ToolError, ToolExecutionResult, ToolId } from "../tool";

export class CreateFileTool implements Tool {
  name: ToolId = "create_file";
  description = "Creates a new file (args: file, content)";
  params = {
    file: {
      type: "string",
      description: "The path of the file to create",
    },
    content: {
      type: "string",
      description: "The content to write to the file",
    },
  };

  async execute(args: {
    file: string;
    content: string;
  }): Promise<ToolExecutionResult> {
    if (!args.file) {
      throw new ToolError("File path is required");
    }

    try {
      const file = Bun.file(args.file);
      if (await file.exists()) {
        throw new ToolError(`File ${args.file} already exists`);
      }
      await Bun.write(args.file, new TextEncoder().encode(args.content));
      const msg = `Created file: ${args.file}`;
      return {
        result: msg,
        addedFiles: [Source.fromText(args.file, args.content)],
      };
    } catch (error) {
      if (error instanceof ToolError) throw error;
      throw new ToolError(`Failed to create file: ${error.message}`);
    }
  }
}
