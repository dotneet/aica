import { readConfig } from "@/config";
import { getGitDiffToHead } from "@/git";
import { createLLM } from "@/llm/mod";
import { createSummaryContext, summarizeDiff } from "@/summary";
import { z } from "zod";

export const summaryDiffCommandSchema = z.object({
  config: z.string().optional(),
  dir: z.string().optional(),
});

export type SummaryDiffCommandValues = z.infer<typeof summaryDiffCommandSchema>;

export async function executeSummaryDiffCommand(
  values: SummaryDiffCommandValues,
) {
  const configFilePath = values.config || null;
  const config = await readConfig(configFilePath);
  const targetDir = values.dir || config.workingDirectory;

  const summaryContext = createSummaryContext(
    createLLM(config.llm),
    config.summary.prompt.system,
    config.summary.prompt.rules,
    config.summary.prompt.user,
  );

  const diff = await getGitDiffToHead(targetDir);
  if (diff.length === 0) {
    console.log("No diff found.");
    return;
  }

  const summaryDiffItems = await summarizeDiff(summaryContext, diff);
  const summary = summaryDiffItems
    .map((item) => {
      return ` - ${item.category}: ${item.description}`;
    })
    .join("\n");
  console.log(`${summary}`);
}
