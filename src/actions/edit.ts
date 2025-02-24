import { Agent } from "@/agent/agent";
import { executeCommit } from "@/commands/commit-command";
import type { Config } from "@/config";
import { GitRepository } from "@/git";
import type { Octokit } from "@/github";
import type { GitHubIssueComment, GitHubPullRequest } from "@/github/types";
import { createLLM } from "@/llm/factory";
import { $ } from "bun";

export type PerformEditOptions = {
  dryRun: boolean;
};

export async function performEdit(
  config: Config,
  octokit: Octokit,
  owner: string,
  repo: string,
  pullRequest: GitHubPullRequest,
  comment: GitHubIssueComment | undefined,
  prompt: string,
  opts: Partial<PerformEditOptions> = {},
): Promise<void> {
  const options = {
    dryRun: false,
    ...opts,
  };
  console.log("Starting edit process...");
  if (comment?.pull_request_review_id) {
    await octokit.rest.reactions.createForPullRequestReviewComment({
      owner,
      repo,
      pull_number: pullRequest.number,
      comment_id: comment.id,
      content: "eyes",
    });
  } else if (comment) {
    await octokit.rest.reactions.createForIssueComment({
      owner,
      repo,
      issue_number: pullRequest.number,
      comment_id: comment?.id,
      content: "eyes",
    });
  }

  if (!pullRequest) {
    throw new Error("Pull request is required");
  }

  const repoDir = Bun.env.GITHUB_WORKSPACE;
  if (!repoDir) {
    throw new Error("GITHUB_WORKSPACE is required");
  }
  const gitRepository = new GitRepository(repoDir);
  const llm = createLLM(config.llm);
  await using agent = new Agent(gitRepository, llm, config);

  try {
    const promptWithContext = await buildPrompt(
      prompt,
      gitRepository,
      pullRequest,
      comment,
    );

    // Edit a file
    console.log(`Final prompt: ${promptWithContext}`);
    await agent.startTask(promptWithContext);

    // Commit changes
    let commitMessage = "Edit by AICA";
    if (options.dryRun) {
      console.log("Dry run: Changes will not be pushed.");
    } else {
      await $`git config --global user.email "action@github.com"`;
      await $`git config --global user.name "actions-user"`;

      const commitResult = await executeCommit(
        gitRepository.gitRootDir,
        config,
        {
          push: true,
          dryRun: options.dryRun,
        },
      );
      commitMessage = commitResult.commitMessage;
    }

    // Comment the result
    const message = `task completed.\n${commitMessage}`;
    if (options.dryRun) {
      console.log(`Dry run: ${message}`);
    } else {
      if (comment?.pull_request_review_id) {
        await octokit.rest.pulls.createReplyForReviewComment({
          owner,
          repo,
          pull_number: pullRequest.number,
          comment_id: comment.id,
          body: message,
        });
      } else {
        await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: pullRequest.number,
          body: message,
        });
      }
    }
  } catch (error) {
    console.error("Error occurred during edit process:", error);
    throw error;
  }
}

async function buildPrompt(
  userPrompt: string,
  gitRepository: GitRepository,
  pullRequest: GitHubPullRequest | undefined,
  comment: GitHubIssueComment | undefined,
): Promise<string> {
  let finalPrompt = `
Modify the files according to the edit_task.
Read the related files using read_file tool and edit the files using edit_file tool.
You can use only one tool at a time.
Please process one by one in order.

<edit_task>
${userPrompt}
</edit_task>
`;

  if (comment) {
    if (comment.diff_hunk) {
      let lineRange = `${comment.line}`;
      if (comment.original_start_line) {
        lineRange = `${comment.start_line} - ${comment.line}`;
      }
      finalPrompt += `
Focus on editing the codes related to the following diff hunk and line range.

<diff_hunk>
<path>${comment.path}</path>
<line_range>${lineRange}</line_range>
<hunk_body>
${comment.diff_hunk}
</hunk_body>
</diff_hunk>
`;
    }
  } else if (pullRequest) {
    const currentBranch = await gitRepository.getCurrentBranch();
    const remoteName = await gitRepository.getDefaultRemoteName();
    let prDiff = "";
    if (pullRequest) {
      prDiff = await gitRepository.getBranchDiffLikePullRequest(
        `${remoteName}/${pullRequest.base.ref}`,
        currentBranch,
      );
    }

    finalPrompt += `
<diff_of_pull_request>
${prDiff}
</diff_of_pull_request>
`;
  }
  return finalPrompt;
}
