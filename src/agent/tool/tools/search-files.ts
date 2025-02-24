import { globby } from "globby";
import {
  type Tool,
  ToolError,
  type ToolExecutionContext,
  type ToolExecutionResult,
  type ToolId,
} from "../tool";

export class SearchFilesTool implements Tool {
  name: ToolId = "search_files";
  description =
    "Perform a regex search across files in a specified directory (args: path, regex, filePattern?)";
  params = {
    path: {
      type: "string",
      description: "The directory to search for files",
    },
    regex: {
      type: "string",
      description: "The regex pattern to search for",
    },
    filePattern: {
      type: "string",
      description: "The file pattern to search for",
    },
  };

  async execute(
    context: ToolExecutionContext,
    args: {
      path: string;
      regex: string;
      filePattern?: string;
    },
  ): Promise<ToolExecutionResult> {
    if (!args.path) {
      throw new ToolError("Directory path is required");
    }
    if (!args.regex) {
      throw new ToolError("Regex pattern is required");
    }

    try {
      const pattern = args.filePattern || "**/*";
      const files = await globby(pattern, { cwd: args.path });
      const regExp = new RegExp(args.regex, "g");
      const results: string[] = [];

      for (const file of files) {
        const fullPath = `${args.path}/${file}`;
        const content = await Bun.file(fullPath).text();
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          if (regExp.test(lines[i])) {
            const context = {
              before: lines.slice(Math.max(0, i - 2), i).join("\n"),
              match: lines[i],
              after: lines
                .slice(i + 1, Math.min(lines.length, i + 3))
                .join("\n"),
            };

            results.push(
              `File: ${file}\nLine: ${i + 1}\nContext:\n${context.before}\n>> ${
                context.match
              }\n${context.after}\n`,
            );
          }
          regExp.lastIndex = 0; // Reset regex state
        }
      }

      if (results.length === 0) {
        return {
          result: "No matches found.",
        };
      }

      return {
        result: results.join("\n---\n"),
      };
    } catch (error) {
      if (error instanceof ToolError) throw error;
      if (error instanceof Error) {
        throw new ToolError(`Failed to search files: ${error.message}`);
      }
      throw new ToolError(`Failed to search files: ${error}`);
    }
  }
}
