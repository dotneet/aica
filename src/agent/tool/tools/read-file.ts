import { Tool, ToolError, ToolExecutionResult, ToolId } from "../tool";
import { Source } from "@/source";

export class ReadFileTool implements Tool {
  name: ToolId = "read_file";
  description =
    "Read the contents of a file at the specified path. Use this when you need to examine the contents of an existing file, for example to analyze code, review text files, or extract information from configuration files. Automatically extracts raw text from PDF and DOCX files. May not be suitable for other types of binary files, as it returns the raw content as a string.";
  params = {
    path: {
      type: "string",
      description: "The path of the file to read",
    },
  };

  async execute(args: { path: string }): Promise<ToolExecutionResult> {
    if (!args.path) {
      throw new ToolError("File path is required");
    }

    try {
      const file = Bun.file(args.path);
      if (!(await file.exists())) {
        return {
          result: `File ${args.path} does not exist`,
        };
      }
      const content = await file.text();
      const src = Source.fromText(args.path, content);
      return {
        result: `Read ${src.path}`,
        addedFiles: [src],
      };
    } catch (error) {
      if (error instanceof ToolError) throw error;
      if (error instanceof Error) {
        throw new ToolError(`Failed to read file: ${error.message}`);
      } else {
        throw new ToolError(`Failed to read file: ${error}`);
      }
    }
  }
}
