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
});

export type CommitCommandValues = z.infer<typeof commitCommandSchema>;

export async function executeCommitCommand(
  values: CommitCommandValues,
): Promise<CommitCommandResult> {
  const { staged, dryRun } = values;
  const config = await readConfig();

  const cwd = process.cwd();
  const gitRoot = await GitRepository.getRepositoryRoot(cwd);
  if (!gitRoot) {
    throw new Error("Not a git repository");
  }

  return executeCommit(gitRoot, config, staged, dryRun);
}

export async function executeCommit(
  gitRoot: string,
  config: Config,
  staged: boolean,
  dryRun: boolean,
): Promise<CommitCommandResult> {
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

  if (!dryRun) {
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

  const diff = await git.getGitDiffStageOnly();
  if (!diff) {
    console.log("No changes to commit");
    return {
      hasCommited: false,
      commitMessage: "",
    };
  }

  const commitMessage = await createCommitMessageFromDiff(config, diff);
  if (dryRun) {
    console.log("Dry Run\ncommit message: '" + commitMessage + "'");
  } else {
    await git.commit(commitMessage);
  }

  return {
    hasCommited: true,
    commitMessage,
  };
}
