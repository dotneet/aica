import { type Config, readConfig } from "@/config";
import { GitRepository } from "@/git";
import { Octokit, getGitHubToken } from "@/github";
import { PullRequest } from "@/github";
import { createBranchName } from "@/github/branch";
import { generateSummary } from "@/github/summary";
import { z } from "zod";
import { executeCommit } from "./commit-command";
import { createCommitMessageFromDiff } from "./commit-message-command";

export const createPrCommandSchema = z.object({
  staged: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  baseBranch: z.string().default("main"),
  branchName: z.string().optional(),
  withSummary: z.boolean().optional(),
  title: z.string().optional(),
  body: z.string().optional(),
  draft: z.boolean().optional(),
});

export type CreatePrCommandValues = z.infer<typeof createPrCommandSchema>;

export async function executeCreatePrCommand(
  values: CreatePrCommandValues,
): Promise<void> {
  const config = await readConfig();
  const {
    staged,
    dryRun,
    baseBranch,
    branchName,
    title,
    body,
    draft: argDraft,
    withSummary: argWithSummary,
  } = values;

  const draft = argDraft ?? config.pullRequest.draft;
  const withSummary = argWithSummary ?? config.pullRequest.withSummary;

  const cwd = process.cwd();
  const gitRoot = await GitRepository.getRepositoryRoot(cwd);
  if (!gitRoot) {
    throw new Error("Not in a git repository");
  }
  const git = new GitRepository(gitRoot);

  await git.fetchRemote();

  // get repository info
  const { owner, repo } = await git.getOriginOwnerAndRepo();

  // commit the changes
  await executeCommit(gitRoot, config, { staged, dryRun });

  // get current branch
  const currentBranch = await git.getCurrentBranch();

  const remoteName = await git.getDefaultRemoteName();
  if (!remoteName) {
    throw new Error("No remote base branch found");
  }

  // get diff
  const diff = await git.getBranchDiffLikePullRequest(
    `${remoteName}/${baseBranch}`,
    currentBranch,
  );

  if (!diff) {
    throw new Error("No changes to commit");
  }

  let targetBranchName = branchName;
  if (!targetBranchName) {
    targetBranchName = await createBranchName(config, diff);
  }
  const prTitle = title || (await createCommitMessageFromDiff(config, diff));
  let prBody = body || "";
  if (withSummary) {
    const summary = await generateSummary(config, diff);
    prBody = prBody ? `${prBody}\n\n${summary}` : summary;
  }
  if (!dryRun) {
    if (currentBranch !== targetBranchName) {
      await git.createBranch(targetBranchName);
      await git.switchBranch(targetBranchName);
    }
    await git.pushToRemote(remoteName, targetBranchName);

    const token = await getGitHubToken();
    const octokit = new Octokit({
      auth: token,
    });

    const pr = await PullRequest.create(
      octokit,
      owner,
      repo,
      prTitle,
      prBody,
      baseBranch,
      targetBranchName,
      draft,
    );
    console.log(`Pull request created: ${pr.getUrl()}`);
  } else {
    console.log("Dry run: would create pull request with:");
    console.log(`  Title: ${prTitle}`);
    console.log(`  Body: ${prBody}`);
    console.log(`  Head: ${targetBranchName}`);
    console.log(`  Base: ${baseBranch}`);
    console.log(`  Draft: ${draft}`);
  }
}
