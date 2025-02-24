import { type Config, readConfig } from "@/config";
import { GitRepository } from "@/git";
import { createLLM } from "@/llm/mod";
import {
  type SummaryContext,
  type SummaryDiffItem,
  createSummaryContext,
  summarizeDiff,
} from "@/summary";
import { z } from "zod";

export const summaryDiffCommandSchema = z.object({
  dryRun: z.boolean().default(false),
});

export type SummaryDiffCommandValues = z.infer<typeof summaryDiffCommandSchema>;

export async function executeSummaryDiffCommand(
  values: SummaryDiffCommandValues,
): Promise<void> {
  const config = await readConfig();
  const targetDir = process.cwd();
  const git = new GitRepository(targetDir);
  const diff = await git.getGitDiffFromHead();
  if (!diff) {
    throw new Error("No changes to summarize");
  }

  const llm = createLLM(config.llm);
  const summaryContext = createSummaryContext(
    llm,
    config.summary.prompt.system,
    config.summary.prompt.rules,
    config.summary.prompt.user,
  );

  const summaryDiffItems = await summarizeDiff(summaryContext, diff);
  const summary = summaryDiffItems
    .map((item) => `- ${item.category}: ${item.description}`)
    .join("\n");

  console.log(summary);
}
