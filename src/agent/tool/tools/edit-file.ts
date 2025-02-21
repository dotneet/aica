import { Source } from "@/source";
import { Tool, ToolError, ToolExecutionResult, ToolId } from "../tool";
import {
  applyPatch,
  checkPatchFormat,
  createPatchFromDiff,
  Patch,
} from "@/agent/patch";

export class EditFileTool implements Tool {
  name: ToolId = "edit_file";
  description =
    "Edits an existing file (args: file, patch) - patch must be a unified format diff.";
  params = {
    file: {
      type: "string",
      description: "The path of the file to edit",
    },
    patch: {
      type: "string",
      description: "The unified format diff patch to apply",
    },
  };

  async execute(args: {
    file: string;
    patch: string;
  }): Promise<ToolExecutionResult> {
    if (!args.file || !args.patch) {
      throw new ToolError("File path and patch are required");
    }

    try {
      const file = Bun.file(args.file);
      if (!(await file.exists())) {
        throw new ToolError(`File ${args.file} does not exist`);
      }

      const currentContent = await file.text();
      let patch: Patch;
      try {
        patch = JSON.parse(args.patch);
        if (!checkPatchFormat(patch)) {
          throw new ToolError(`Invalid patch format. patch:\n${args.patch}`);
        }
      } catch (e) {
        try {
          patch = createPatchFromDiff(args.patch);
        } catch (e2) {
          throw new ToolError(
            `Invalid patch format. patch:\n${args.patch}\nerror:\n${e2}`,
          );
        }
      }

      const newContent = applyPatch(currentContent, patch);
      await Bun.write(args.file, newContent);
      return {
        result: `Edited file: ${args.file}`,
        addedFiles: [Source.fromText(args.file, newContent)],
      };
    } catch (error) {
      if (error instanceof ToolError) throw error;
      if (error instanceof Error) {
        throw new ToolError(`Failed to edit file: ${error.message}`);
      } else {
        throw new ToolError(`Failed to edit file: ${error}`);
      }
    }
  }
}
