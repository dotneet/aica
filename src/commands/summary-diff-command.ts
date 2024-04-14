import { readConfig } from "config";
import { getGitDiff } from "git";
import { LLM } from "llm";
import { createSummaryContext, summarizeCode as summarizeDiff } from "summary";

export async function executeSummaryDiffCommand(values: any) {
  const configFilePath = values.config || null;
  const targetDir = values.dir || ".";
  const pattern = values.pattern;

  const config = await readConfig(configFilePath);

  const summaryContext = createSummaryContext(
    new LLM(config.llm.apiKey, config.llm.model),
    config.summary.prompt.system,
    config.summary.prompt.rules,
    config.summary.prompt.user
  );

  const diff = await getGitDiff(targetDir);
  if (diff.length === 0) {
    console.log("No diff found.");
    return;
  }

  const summary = await summarizeDiff(summaryContext, diff);
  console.log(`${summary}`);
}
