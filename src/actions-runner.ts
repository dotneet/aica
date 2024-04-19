import {
  Issue,
  analyzeCodeForBugs,
  createAnalyzeContextFromConfig,
} from "@/analyze";
import { Config, readConfig } from "@/config";
import {
  PullRequest,
  createGitHubStyleTableFromIssues,
  createGitHubStyleTableFromSummaryDiffItems,
} from "@/github";
import { Source } from "@/source";
import { parseDiff } from "@/utility/parse-diff";
import core from "@actions/core";
import github from "@actions/github";
import { LLM } from "./llm";
import { createSummaryContext, summarizeDiff } from "./summary";

async function generateSummary(
  config: Config,
  diffString: string,
): Promise<string> {
  const summaryContext = createSummaryContext(
    new LLM(config.llm.apiKey, config.llm.model),
    config.summary.prompt.system,
    config.summary.prompt.rules,
    config.summary.prompt.user,
  );
  const summaryDiffItems = await summarizeDiff(summaryContext, diffString);
  return createGitHubStyleTableFromSummaryDiffItems(summaryDiffItems);
}

async function generateReview(
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

function buildSummaryBody(body: string, summary: string): string {
  const summaryPrefix = "<!-- AICA GENERATED -->\n## Summary";
  let newBody = "";
  if (body) {
    const index = body.indexOf(summaryPrefix);
    if (index !== -1) {
      newBody = body.slice(0, index) + summaryPrefix + "\n\n" + summary;
    } else {
      newBody = body + "\n\n" + summaryPrefix + "\n\n" + summary;
    }
  } else {
    newBody = summaryPrefix + "\n\n" + summary;
  }
  return newBody;
}

async function main() {
  try {
    const token = Bun.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("GITHUB_TOKEN is required");
    }
    const octokit = github.getOctokit(token);
    const config = await readConfig(null);
    const payload = github.context.payload;
    // console.log("Payload", JSON.stringify(payload, null, 2));

    const fullRepoName = Bun.env.GITHUB_REPOSITORY;
    const [owner, repo] = fullRepoName.split("/");
    const pull_number = payload.pull_request.number;

    const pullRequest = new PullRequest(octokit, owner, repo, pull_number);
    const diffString = await pullRequest.getDiff(pull_number);

    const summary = await generateSummary(config, diffString);
    const body = (await pullRequest.getBody()) || "";
    const newBody = buildSummaryBody(body, summary);
    pullRequest.updateBody(newBody);

    const reviewResultTable = await generateReview(config, diffString);
    const comment = "## Bug Report\n\n" + reviewResultTable;
    await pullRequest.postComment(comment);
  } catch (error) {
    core.setFailed(error.message);
  }
}

await main();
