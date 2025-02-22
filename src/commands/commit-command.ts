import { readConfig, type Config } from "@/config";
import { GitRepository } from "@/git";
import { z } from "zod";
import { createCommitMessageFromDiff } from "./commit-message-command";

export type CommitCommandResult = {
  hasCommited: boolean;
  commitMessage: string;
};

export const commitCommandSchema = z.object({
  staged: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  push: z.boolean().default(false),
});

export type CommitCommandValues = z.infer<typeof commitCommandSchema>;

export async function executeCommitCommand(
  values: CommitCommandValues,
): Promise<CommitCommandResult> {
  const config = await readConfig();

  const cwd = process.cwd();
  const gitRoot = await GitRepository.getRepositoryRoot(cwd);
  if (!gitRoot) {
    throw new Error("Not a git repository");
  }

  return executeCommit(gitRoot, config, values);
}

const commitOptionsSchema = z.object({
  push: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  staged: z.boolean().default(false),
});
type CommitOptions = z.infer<typeof commitOptionsSchema>;

const defaultCommitOptions: CommitOptions = {
  push: false,
  dryRun: false,
  staged: false,
};

export async function executeCommit(
  gitRoot: string,
  config: Config,
  opts: Partial<CommitOptions>,
): Promise<CommitCommandResult> {
  const options = { ...defaultCommitOptions, ...opts };
  const { push, dryRun, staged } = options;

  const git = new GitRepository(gitRoot);
  const changes = await git.getAddingFilesToStage();

  if (changes.confirmationRequiredFiles.length > 0) {
    console.log("Some files require confirmation:");
    for (const file of changes.confirmationRequiredFiles) {
      console.log(`  ${file.file}: ${file.message}`);
    }
    if (!dryRun) {
      throw new Error("Some files require confirmation");
    }
  }

  if (!staged && !dryRun && changes.addingFiles.length > 0) {
    await git.addFilesToStage(changes.addingFiles);
  }

  if (staged) {
    const allChangedFiles = await git.getAllChangedFiles();
    if (!allChangedFiles.hasChanges) {
      console.log("No changes to commit");
      return {
        hasCommited: false,
        commitMessage: "",
      };
    }
  }

  let diff: string | null = null;
  if (dryRun) {
    diff = await git.getGitDiffFromHead();
  } else {
    diff = await git.getGitDiffStageOnly();
  }
  if (!diff) {
    console.log("No changes to commit");
    return {
      hasCommited: false,
      commitMessage: "",
    };
  }

  const commitMessage = await createCommitMessageFromDiff(config, diff);
  if (dryRun) {
    console.log("DryRun: commit message is '" + commitMessage + "'");
  } else {
    await git.commit(commitMessage);
    console.log(`committed: ${commitMessage}`);
  }

  if (push) {
    const remote = await git.getDefaultRemoteName();
    if (!remote) {
      throw new Error("No remote found");
    }
    const branch = await git.getCurrentBranch();
    if (dryRun) {
      console.log(`DryRun: push ${branch} to ${remote}/${branch}`);
    } else {
      await git.pushToRemote(remote, branch);
      console.log(`pushed ${branch} to ${remote}/${branch}`);
    }
  }

  return {
    hasCommited: true,
    commitMessage,
  };
}
