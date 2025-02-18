import { getGitHubToken, PullRequest } from "@/github";
import { readConfig } from "@/config";
import { Octokit } from "@/github";
import { generateSummary } from "@/github/summary";
import {
  commit,
  fetchRemote,
  getBranchDiffLikePullRequest,
  getCurrentBranch,
  getGitDiffFromRemoteBranch,
  getGitDiffToHead,
  getGitRepositoryRoot,
  getOriginOwnerAndRepo,
  pushToRemote,
} from "@/git";
import { createCommitMessageFromDiff } from "./commit-message-command";
import { createBranchName } from "@/github/branch";
import { CommandError } from "./error";
import { executeCommit } from "./commit-command";
import { z } from "zod";

export const createPRValuesSchema = z.object({
  config: z.string().optional(),
  withSummary: z.boolean().default(true),
  dryRun: z.boolean().default(false),
  staged: z.boolean().default(false),
  body: z.string().default(""),
});

export type CreatePRValues = z.infer<typeof createPRValuesSchema>;

export async function executeCreatePRCommand(values: CreatePRValues) {
  const config = await readConfig(values.config);
  const withSummary = values.withSummary;
  const dryRun = values.dryRun;
  const staged = values.staged;
  let prBody = values.body;

  const gitRoot = await getGitRepositoryRoot(process.cwd());
  if (!gitRoot) {
    throw new CommandError("Not a git repository.");
  }

  // add the changes to the staging area
  await fetchRemote(gitRoot);
  console.log("Fetched remote branches");

  const gitHubToken = await getGitHubToken();
  const octokit = new Octokit({ auth: gitHubToken });
  const { owner, repo } = await getOriginOwnerAndRepo(gitRoot);
  const response = await octokit.rest.repos.get({
    owner,
    repo,
  });

  // commit the changes
  await executeCommit(gitRoot, config, staged, dryRun);

  // get the current branch
  const currentBranch = await getCurrentBranch(gitRoot);

  // create a summary of the changes
  const defaultBranch = response.data.default_branch;
  const diff = await getBranchDiffLikePullRequest(
    gitRoot,
    defaultBranch,
    currentBranch,
  );
  if (!diff) {
    throw new CommandError("No changes to commit");
  }
  console.log("Got diff to remote default branch");

  // create a summary of the changes
  if (withSummary) {
    const summary = await generateSummary(config, diff);
    if (!summary) {
      throw new CommandError("Failed to create a summary");
    }
    console.log("Generated summary");
    if (prBody) {
      prBody += "\n\n" + summary;
    } else {
      prBody = summary;
    }
  }

  // create a branch name
  const branchName = await createBranchName(config, diff);
  if (!branchName) {
    throw new CommandError("Failed to create a branch name");
  }
  console.log(`Created branch name: "${branchName}"`);

  // push current branch to remote as a new branch
  if (dryRun) {
    console.log(`Dry run: would push ${currentBranch} to ${branchName}`);
  } else {
    try {
      await pushToRemote(gitRoot, `${currentBranch}:${branchName}`);
      console.log(`Pushed ${currentBranch} to ${branchName}`);
    } catch (error) {
      throw new CommandError("Failed to push to remote.", error as Error);
    }
  }

  // create a pull request
  if (dryRun) {
    console.log(`Dry run: would create a pull request`);
  } else {
    const prTitle = await createCommitMessageFromDiff(config, diff);
    const pr = await PullRequest.create(
      octokit,
      owner,
      repo,
      prTitle,
      prBody,
      defaultBranch,
      branchName,
    );
    console.log(`Created pull request:\n${pr.getUrl()}`);
  }
}
