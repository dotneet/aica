import { Config } from "@/config";
import { PullRequest } from "@/github";
import { generateReview, generateSummary } from "@/github/mod";
import { Octokit } from "@/github";

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

export async function performSummaryAndReview(
  config: Config,
  octokit: Octokit,
  owner: string,
  repo: string,
  pull_number: number
): Promise<void> {
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
}