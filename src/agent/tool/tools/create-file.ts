import { Source } from "@/source";
import {
  type Tool,
  ToolError,
  type ToolExecutionContext,
  type ToolExecutionResult,
  type ToolId,
} from "../tool";

export class CreateFileTool implements Tool {
  name: ToolId = "create_file";
  description =
    "Creates a new file." +
    "You can use this tool multiple times at once." +
    "Created files will be stored as referenced files in the system prompt." +
    "You can use this tool with other tools at the same time.";

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

  async execute(
    context: ToolExecutionContext,
    args: {
      file: string;
      content: string;
    },
  ): Promise<ToolExecutionResult> {
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
      if (error instanceof Error) {
        throw new ToolError(`Failed to create file: ${error.message}`);
      }
      throw new ToolError(`Failed to create file: ${error}`);
    }
  }
}
