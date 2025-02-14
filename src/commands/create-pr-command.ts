import { getGitHubToken, PullRequest } from "@/github";
import { readConfig } from "@/config";
import { Octokit } from "octokit";
import { generateSummary } from "@/github/summary";
import {
  commit,
  getCurrentBranch,
  getGitDiffToHead,
  getGitRepositoryRoot,
  getOriginOwnerAndRepo,
  pushToRemote,
} from "@/git";
import { createCommitMessageFromDiff } from "./commit-message-command";
import { createBranchName } from "@/github/branch";
import { CommandError } from "./error";

export async function executeCreatePRCommand(values: any) {
  const config = await readConfig(values.config);
  const dryRun = values.dryRun;
  const stageOnly = values.stageOnly;

  const gitRoot = await getGitRepositoryRoot(process.cwd());
  if (!gitRoot) {
    throw new CommandError("Not a git repository.");
  }

  // add the changes to the staging area
  if (!stageOnly) {
    console.log("Adding all changes to the staging area");
    const addResult = Bun.spawn(["git", "add", "."], { cwd: gitRoot });
    await addResult.exited;
  }

  // create a summary of the changes
  const diff = await getGitDiffToHead(gitRoot);
  if (!diff) {
    throw new CommandError("No changes to commit");
  }

  // create a commit message
  const commitMessage = await createCommitMessageFromDiff(config, diff);
  if (!commitMessage) {
    throw new CommandError("Failed to create a commit message");
  }
  if (dryRun) {
    console.log(`Dry run: would commit with message "${commitMessage}"`);
  } else {
    const success = await commit(gitRoot, commitMessage);
    if (!success) {
      throw new CommandError("Failed to commit");
    }
  }

  // create a summary of the changes
  const summary = await generateSummary(config, diff);
  if (!summary) {
    throw new CommandError("Failed to create a summary");
  }

  // create a branch name
  const branchName = await createBranchName(config, diff);
  if (!branchName) {
    throw new CommandError("Failed to create a branch name");
  }

  // get the current branch
  const currentBranch = await getCurrentBranch(gitRoot);

  // push current branch to remote as a new branch
  if (dryRun) {
    console.log(`Dry run: would push ${currentBranch} to ${branchName}`);
  } else {
    try {
      await pushToRemote(gitRoot, `${currentBranch}:${branchName}`);
    } catch (error) {
      throw new CommandError("Failed to push to remote.", error as Error);
    }
  }

  // create a pull request
  const gitHubToken = await getGitHubToken();
  if (dryRun) {
    console.log(`Dry run: would create a pull request`);
  } else {
    const octokit = new Octokit({ auth: gitHubToken });
    const { owner, repo } = await getOriginOwnerAndRepo(gitRoot);
    const response = await octokit.rest.repos.get({
      owner,
      repo,
    });
    const defaultBranch = response.data.default_branch;
    const pr = await PullRequest.create(
      octokit,
      owner,
      repo,
      commitMessage,
      summary,
      defaultBranch,
      branchName,
    );
    console.log(`Created pull request:\n${pr.getUrl()}`);
  }
}
