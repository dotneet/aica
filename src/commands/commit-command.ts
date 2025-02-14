import { readConfig } from "@/config";
import { getGitRepositoryRoot, commit, getGitDiffToHead } from "@/git";
import { createCommitMessageFromDiff } from "./commit-message-command";
import { CommandError } from "./error";

export async function executeCommitCommand(values: any) {
  const config = await readConfig(values.config);
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

  const success = await commit(gitRoot, commitMessage);
  if (!success) {
    throw new CommandError("Failed to commit");
  }

  console.log(`Successfully committed with message: "${commitMessage}"`);
}
