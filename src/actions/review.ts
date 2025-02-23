import { Config } from "@/config";
import { Octokit, PullRequest } from "@/github";
import { generateReview } from "@/github/mod";

export async function performReviewCommand(
  config: Config,
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<void> {
  console.log("Generating review...");
  const pullRequest = new PullRequest(octokit, owner, repo, pullNumber);
  const diffString = await pullRequest.getDiff(pullNumber);
  const reviewResultTable = await generateReview(config, diffString);
  const comment = "## Bug Report\n\n" + reviewResultTable;
  await pullRequest.postComment(comment);
}
