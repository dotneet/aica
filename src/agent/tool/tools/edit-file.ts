import { Source } from "@/source";
import {
  Tool,
  ToolError,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolId,
} from "../tool";
import {
  applyPatch,
  checkPatchFormat,
  createPatchFromDiff,
  Patch,
} from "@/agent/patch";
import { applyPatchWithSimilarity } from "@/agent/similarity-patch";

export class EditFileTool implements Tool {
  name: ToolId = "edit_file";
  description =
    "Edits a file. generate precise code changes as a unified format diff.";
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

  async execute(
    context: ToolExecutionContext,
    args: {
      file: string;
      patch: string;
    },
  ): Promise<ToolExecutionResult> {
    if (!args.file || !args.patch) {
      throw new ToolError("File path and patch are required");
    }

    try {
      const file = Bun.file(args.file);
      if (!(await file.exists())) {
        throw new ToolError(`File ${args.file} does not exist`);
      }

      const currentContent = await file.text();
      const newContent = applyPatchWithSimilarity(currentContent, args.patch);
      await Bun.write(args.file, newContent);
      return {
        result: `Successfully edited file: ${args.file}`,
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

// Most of the prompt from Roo-Code
// https://github.com/RooVetGit/Roo-Code/blob/main/src/core/diff/strategies/new-unified/index.ts#L110
export const diffToolPrompt = `
Generate a unified diff that can be cleanly applied to modify code files.

## Step-by-Step Instructions:

1. Start with file headers:
   - First line: "--- {original_file_path}"
   - Second line: "+++ {new_file_path}"

2. For each change section:
   - Begin with "@@ ... @@" separator line without line numbers
   - Include 2-3 lines of context before and after changes
   - Mark removed lines with "-"
   - Mark added lines with "+"
   - Preserve exact indentation

3. Group related changes:
   - Keep related modifications in the same hunk
   - Start new hunks for logically separate changes
   - When modifying functions/methods, include the entire block

## Requirements:

1. MUST include exact indentation
2. MUST include sufficient context for unique matching
3. MUST group related changes together
4. MUST use proper unified diff format
5. MUST NOT include timestamps in file headers
6. MUST NOT include line numbers in the @@ header

## Examples:

✅ Good diff (follows all requirements):
\`\`\`diff
--- src/utils.ts
+++ src/utils.ts
@@ ... @@
    def calculate_total(items):
-      total = 0
-      for item in items:
-          total += item.price
+      return sum(item.price for item in items)
\`\`\`

❌ Bad diff (violates requirements #1 and #2):
\`\`\`diff
--- src/utils.ts
+++ src/utils.ts
@@ ... @@
-total = 0
-for item in items:
+return sum(item.price for item in items)
\`\`\`
`;
