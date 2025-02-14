import { Config, readConfig } from "@/config";
import {
  getGitRepositoryRoot,
  commit,
  getGitDiffToHead,
  getAddingFilesToStage,
  addFilesToStage,
  getAllChangedFiles,
} from "@/git";
import { createCommitMessageFromDiff } from "./commit-message-command";
import { CommandError } from "./error";

export type CommitCommandResult = {
  changedFiles: string[];
  hasCommited: boolean;
  commitMessage: string;
  diff: string;
};

export async function executeCommitCommand(
  values: any,
): Promise<CommitCommandResult> {
  const config = await readConfig(values.config);
  const stageOnly = values.stageOnly;
  const dryRun = values.dryRun;

  const gitRoot = await getGitRepositoryRoot(process.cwd());
  if (!gitRoot) {
    throw new CommandError("Not in a git repository.");
  }
  return executeCommit(gitRoot, config, stageOnly, dryRun);
}

export async function executeCommit(
  gitRoot: string,
  config: Config,
  stageOnly: boolean,
  dryRun: boolean,
): Promise<CommitCommandResult> {
  const changes = await getAddingFilesToStage(gitRoot);
  if (!stageOnly) {
    if (changes.confirmationRequiredFiles.length > 0) {
      throw new CommandError(
        "The following files are too large to add to the staging area:\n" +
          changes.confirmationRequiredFiles
            .map((file) => `- ${file.file}`)
            .join("\n"),
      );
    }
    if (dryRun) {
      console.log(
        "Dry run: would add the following files to the staging area:\n" +
          changes.addingFiles.map((file) => `- ${file}`).join("\n"),
      );
    } else {
      await addFilesToStage(gitRoot, changes.addingFiles);
      console.log("Added all changes to the staging area");
    }
  }

  const allChangedFiles = await getAllChangedFiles(gitRoot);
  if (allChangedFiles.stagedFiles.length === 0) {
    console.log("No changes to commit");
    return {
      changedFiles: [],
      hasCommited: false,
      commitMessage: "",
      diff: "",
    };
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
    const files = [
      ...allChangedFiles.stagedFiles,
      ...allChangedFiles.unstagedFiles,
      ...allChangedFiles.untrackedFiles,
    ];
    console.log(
      `Dry run: would commit with message "${commitMessage}" \n commit files:\n - ${files.join(
        "\n - ",
      )}`,
    );
  } else {
    const success = await commit(gitRoot, commitMessage);
    if (!success) {
      throw new CommandError("Failed to commit");
    }
    console.log(`Successfully committed with message: "${commitMessage}"`);
  }

  return {
    changedFiles: allChangedFiles.stagedFiles,
    hasCommited: true,
    commitMessage,
    diff,
  };
}
