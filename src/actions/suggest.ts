import type { Config } from "@/config";
import type { Octokit } from "@/github";
import type { GitHubIssueComment, GitHubPullRequest } from "@/github/types";

export async function performSuggest(
  config: Config,
  octokit: Octokit,
  owner: string,
  repo: string,
  pullRequest: GitHubPullRequest,
  comment: GitHubIssueComment | undefined,
  prompt: string,
): Promise<void> {
  console.log("Starting suggest process...");
  if (!pullRequest) {
    throw new Error("Pull request is required");
  }
  const repoDir = Bun.env.GITHUB_WORKSPACE;
  if (!repoDir) {
    throw new Error("GITHUB_WORKSPACE is required");
  }
  // const gitRepository = new GitRepository(repoDir);
  // const llm = createLLM(config.llm);
  // await using agent = new Agent(gitRepository, llm, config);
  // const finalPrompt = buildPrompt(prompt, comment);
  try {
    // Edit a file
    // await agent.startTask(finalPrompt);
    // TODO: create a suggest
    throw new Error("Not implemented");
  } catch (error) {
    console.error("Error during edit process:", error);
    throw error;
  }
}
