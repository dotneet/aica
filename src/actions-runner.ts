import { readConfig } from "@/config";
import core from "@actions/core";
import github from "@actions/github";
import { $ } from "bun";
import { performEdit } from "./actions/edit";
import { performReviewCommand } from "./actions/review";
import { performSummary } from "./actions/summary";
import { performSummaryAndReview } from "./actions/summary-and-review";
import { Octokit } from "./github";

async function main() {
  console.log("start actions runner...");
  try {
    const token = Bun.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("GITHUB_TOKEN is required");
    }

    if (Bun.env.GITHUB_ACTIONS === "true" && Bun.env.GITHUB_WORKSPACE) {
      // avoid the following error
      //fatal: detected dubious ownership in repository at '/github/workspace'
      await $`git config --global --add safe.directory ${Bun.env.GITHUB_WORKSPACE}`;
    }

    const octokit = new Octokit({ auth: token });
    const config = await readConfig(null);
    const payload = github.context.payload;

    const fullRepoName = Bun.env.GITHUB_REPOSITORY;
    if (!fullRepoName) {
      throw new Error("GITHUB_REPOSITORY is required");
    }
    const [owner, repo] = fullRepoName.split("/");
    if (!payload.pull_request) {
      throw new Error("pull_request is required");
    }
    const eventName = Bun.env.GITHUB_EVENT_NAME;

    if (eventName === "pull_request" || eventName === "pull_request_target") {
      const pullNumber = payload.pull_request.number;
      await performSummaryAndReview(config, octokit, owner, repo, pullNumber);
    } else if (
      eventName === "issue_comment" ||
      eventName === "pull_request_review_comment"
    ) {
      const action = payload.action;
      if (action === "created") {
        const body = payload.comment?.body || "";
        console.log(`comment body: ${body}`);
        const commands = extractCommands(body);
        for (const command of commands) {
          switch (command.command) {
            case "edit":
              if (command.args.length === 0) {
                core.setFailed("edit command requires prompt argument");
                break;
              }
              await performEdit(
                config,
                octokit,
                owner,
                repo,
                payload.issue?.number || 0,
                command.args.join(" "),
              );
              break;
            case "summary":
              await performSummary(
                config,
                octokit,
                owner,
                repo,
                payload.issue?.number || 0,
              );
              break;
            case "review":
              await performReviewCommand(
                config,
                octokit,
                owner,
                repo,
                payload.issue?.number || 0,
              );
              break;
            default:
              core.setFailed(`unknown command: ${command.command}`);
              break;
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed(String(error));
    }
  }
}

type AicaActionsCommand = {
  command: string;
  args: string[];
};

/**
 * extract aica actions command from comment body.
 * multiple commands are allowed in one comment body.
 * command must start with /aica.
 *
 * command format:
 * /aica edit "your prompt here"
 * /aica summary
 * /aica review
 *
 * @returns an array of AicaActionsCommand
 */
function extractCommands(body: string): AicaActionsCommand[] {
  const lines = body.split("\n");
  const commands: AicaActionsCommand[] = [];
  const prefix = "/aica ";
  for (const line of lines) {
    if (line.startsWith(prefix)) {
      const args = line.slice(prefix.length).trim().split(" ");
      const command = args.shift() || "";
      if (command) {
        commands.push({ command, args });
      } else {
        throw new Error("command is required");
      }
    }
  }
  return commands;
}

await main();
