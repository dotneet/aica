import { readConfig, type Config } from "@/config";
import { GitRepository } from "@/git";
import { Octokit } from "@/github";
import { z } from "zod";
import { executeCommit } from "./commit-command";
import { createCommitMessageFromDiff } from "./commit-message-command";

export const createPrCommandSchema = z.object({
  staged: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  baseBranch: z.string().default("main"),
  branchName: z.string().optional(),
  title: z.string().optional(),
  body: z.string().optional(),
  draft: z.boolean().default(false),
});

export type CreatePrCommandValues = z.infer<typeof createPrCommandSchema>;

export async function executeCreatePrCommand(
  values: CreatePrCommandValues,
): Promise<void> {
  const config = await readConfig();
  const { staged, dryRun, baseBranch, branchName, title, body, draft } = values;

  const cwd = process.cwd();
  const gitRoot = await GitRepository.getRepositoryRoot(cwd);
  const git = new GitRepository(gitRoot);
  if (!gitRoot) {
    throw new Error("Not in a git repository");
  }

  await git.fetchRemote();

  // get repository info
  const { owner, repo } = await git.getOriginOwnerAndRepo();

  // commit the changes
  await executeCommit(gitRoot, config, staged, dryRun);

  // get current branch
  const currentBranch = await git.getCurrentBranch();

  // get diff
  const diff = await git.getBranchDiffLikePullRequest(
    baseBranch,
    currentBranch,
  );

  if (!diff) {
    throw new Error("No changes to commit");
  }

  // create pull request
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  const targetBranchName = branchName || currentBranch;

  if (!dryRun) {
    await git.pushToRemote(`${currentBranch}:${targetBranchName}`);
  }

  const prTitle = title || (await createCommitMessageFromDiff(config, diff));

  if (!dryRun) {
    const response = await octokit.rest.pulls.create({
      owner,
      repo,
      title: prTitle,
      body: body || "",
      head: targetBranchName,
      base: baseBranch,
      draft: draft,
    });

    console.log(`Pull request created: ${response.data.html_url}`);
  } else {
    console.log("Dry run: would create pull request with:");
    console.log(`  Title: ${prTitle}`);
    console.log(`  Body: ${body || ""}`);
    console.log(`  Head: ${targetBranchName}`);
    console.log(`  Base: ${baseBranch}`);
    console.log(`  Draft: ${draft}`);
  }
}
