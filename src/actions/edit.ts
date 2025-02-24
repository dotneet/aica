import { Agent } from "@/agent/agent";
import type { Config } from "@/config";
import { GitRepository } from "@/git";
import type { Octokit } from "@/github";
import { createLLM } from "@/llm/factory";
import { $ } from "bun";

export async function performEdit(
  config: Config,
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
  prompt: string,
): Promise<void> {
  console.log("Starting edit process...");

  const repoDir = Bun.env.GITHUB_WORKSPACE;
  if (!repoDir) {
    throw new Error("GITHUB_WORKSPACE is required");
  }
  const gitRepository = new GitRepository(repoDir);
  const llm = createLLM(config.llm);
  await using agent = new Agent(gitRepository, llm, config);

  try {
    // Edit a file
    await agent.startTask(prompt);

    // Commit changes
    await $`git add .`;
    await $`git commit -m "Edit by AICA"`;

    // Push changes
    const currentBranch = await gitRepository.getCurrentBranch();
    const remoteName = await gitRepository.getDefaultRemoteName();
    await $`git push ${remoteName} ${currentBranch}`;

    // Comment the result
    octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: pullNumber,
      body: "new commit is created by AICA",
    });
  } catch (error) {
    console.error("Error during edit process:", error);
    throw error;
  }
}
