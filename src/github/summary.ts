import { Config } from "@/config";
import { createGitHubStyleTableFromSummaryDiffItems } from "@/github";
import { createLLM } from "../llm/factory";
import { createSummaryContext, summarizeDiff } from "../summary";

export async function generateSummary(
  config: Config,
  diffString: string,
): Promise<string> {
  const summaryContext = createSummaryContext(
    createLLM(config.llm),
    config.summary.prompt.system,
    config.summary.prompt.rules,
    config.summary.prompt.user,
  );
  const summaryDiffItems = await summarizeDiff(summaryContext, diffString);
  return createGitHubStyleTableFromSummaryDiffItems(summaryDiffItems);
}
