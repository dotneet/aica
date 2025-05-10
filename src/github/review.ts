import {
  type Issue,
  analyzeCodeForBugs,
  createAnalyzeContextFromConfig,
} from "@/analyze";
import type { Config } from "@/config";
import { Source } from "@/source";
import { parseDiff } from "@/utility/parse-diff";
import { createGitHubStyleTableFromIssues } from "../github";
import { GitRepository } from "@/git";

export async function generateReview(
  config: Config,
  diffString: string,
): Promise<string> {
  const fileChanges = parseDiff(diffString);
  const sources: Source[] = [];
  for (const fileChange of fileChanges) {
    const cwd = process.cwd();
    const root = await GitRepository.getRepositoryRoot(cwd);
    const source = Source.fromPullRequestDiff(root || cwd, fileChange);
    sources.push(source);
  }

  const context = await createAnalyzeContextFromConfig(config);
  const allIssues: Issue[] = [];
  for (const source of sources) {
    if (!source.fileChange) {
      console.log(`Skipping ${source.path} because it has no file change`);
      continue;
    }
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
