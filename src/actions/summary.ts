import type { Config } from "@/config";
import { type Octokit, PullRequest } from "@/github";
import { generateSummary } from "@/github/mod";

function buildSummaryBody(body: string, summary: string): string {
  const createdAt = new Date().toISOString().split("T")[0];
  const summaryPrefix = "<!-- AICA GENERATED -->\n## Summary";
  let newBody = "";
  if (body) {
    const index = body.indexOf(summaryPrefix);
    if (index !== -1) {
      newBody = `${body.slice(0, index) + summaryPrefix}\n\n${summary}`;
    } else {
      newBody = `${body}\n\n${summaryPrefix}\n\n${summary}`;
    }
  } else {
    newBody = `${summaryPrefix}\n\n${summary}`;
  }
  newBody += `\n\nsummary updated at: ${createdAt}`;
  return newBody;
}

export async function performSummary(
  config: Config,
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<void> {
  console.log("Generating summary...");
  const pullRequest = new PullRequest(octokit, owner, repo, pullNumber);
  const diffString = await pullRequest.getDiff(pullNumber);
  const summary = await generateSummary(config, diffString);
  const body = (await pullRequest.getBody()) || "";
  const newBody = buildSummaryBody(body, summary);
  await pullRequest.updateBody(newBody);
}
