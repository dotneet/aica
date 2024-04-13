import core from "@actions/core";
import github from "@actions/github";
import {
  Issue,
  analyzeCodeForBugs,
  createAnalyzeContextFromConfig,
} from "analyze";
import { readConfig } from "config";
import { createGitHubStyleTableFromIssues } from "github";
import { Source } from "source";
import { parseDiff } from "utility/parse-diff";

async function main() {
  try {
    const token = Bun.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("GITHUB_TOKEN is required");
    }
    const octokit = github.getOctokit(token);
    const config = readConfig(null);
    if (!config.llm.apiKey) {
      throw new Error("OPENAI_API_KEY is required");
    }

    const payload = github.context.payload;
    // console.log("Payload", JSON.stringify(payload, null, 2));

    const fullRepoName = Bun.env.GITHUB_REPOSITORY;
    const [owner, repo] = fullRepoName.split("/");
    const pull_number = payload.pull_request.number;
    const endpoint = `GET /repos/{owner}/{repo}/pulls/{pull_number}`;
    const response = await octokit.request(endpoint, {
      owner,
      repo,
      pull_number,
      mediaType: {
        format: "diff",
      },
    });
    const diffString = response.data as unknown as string;
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
      allIssues.push(...result);
    }
    const table = createGitHubStyleTableFromIssues(allIssues);
    const comment = "## Bug Report\n\n" + table;
    await octokit.request(
      "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
      {
        owner,
        repo,
        issue_number: pull_number,
        body: comment,
      }
    );
  } catch (error) {
    core.setFailed(error.message);
  }
}

await main();
