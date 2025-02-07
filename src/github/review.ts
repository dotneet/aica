import { Config } from "@/config";
import {
  Issue,
  analyzeCodeForBugs,
  createAnalyzeContextFromConfig,
} from "@/analyze";
import { Source } from "@/source";
import { parseDiff } from "@/utility/parse-diff";
import { createGitHubStyleTableFromIssues } from "../github";

export async function generateReview(
  config: Config,
  diffString: string,
): Promise<string> {
  const fileChanges = parseDiff(diffString);
  const sources: Source[] = [];
  for (const fileChange of fileChanges) {
    const source = Source.fromPullRequestDiff(fileChange);
    sources.push(source);
  }

  const context = await createAnalyzeContextFromConfig(config);
  const allIssues: Issue[] = [];
  for (const source of sources) {
    console.log(`Analyzing ${source.fileChange.filename}`);
    const result = await analyzeCodeForBugs(context, source);
    console.log(
      `Found ${result.length} issues`,
      result.map((i) => i.description),
    );
    allIssues.push(...result);
  }
  if (allIssues.length === 0) {
    return "No bugs found.";
  }
  return createGitHubStyleTableFromIssues(allIssues);
}
