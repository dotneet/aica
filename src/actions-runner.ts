import { readConfig } from "@/config";
import { PullRequest } from "@/github";
import core from "@actions/core";
import github from "@actions/github";
import { generateReview, generateSummary } from "./github/mod";
import { Octokit } from "./github";

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
  console.log("start actions runner...");
  try {
    const token = Bun.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("GITHUB_TOKEN is required");
    }
    const octokit = new Octokit({ auth: token });
    const config = await readConfig(null);
    const payload = github.context.payload;
    // console.log("Context Payload", JSON.stringify(payload, null, 2));

    const fullRepoName = Bun.env.GITHUB_REPOSITORY;
    const [owner, repo] = fullRepoName.split("/");
    const pull_number = payload.pull_request.number;

    console.log("retrieve pull request diff...");
    const pullRequest = new PullRequest(octokit, owner, repo, pull_number);
    const diffString = await pullRequest.getDiff(pull_number);

    console.log("generate summary...");
    const summary = await generateSummary(config, diffString);
    const body = (await pullRequest.getBody()) || "";
    const newBody = buildSummaryBody(body, summary);

    console.log("update pull request body...");
    await pullRequest.updateBody(newBody);

    console.log("generate review result table...");
    const reviewResultTable = await generateReview(config, diffString);

    console.log("post comment to pull request...");
    const comment = "## Bug Report\n\n" + reviewResultTable;
    await pullRequest.postComment(comment);
  } catch (error) {
    core.setFailed(error.message);
  }
}

await main();
