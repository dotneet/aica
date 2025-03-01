import { executeAgentCommand } from "@/commands/agent-command";
import {
  commitMessageCommandSchema,
  executeCommitMessageCommand,
} from "@/commands/commit-message-command";
import {
  executeReviewCommand,
  reviewCommandSchema,
} from "@/commands/review-command";
import {
  executeSummaryDiffCommand,
  summaryDiffCommandSchema,
} from "@/commands/summary-diff-command";
import yargs from "yargs";
import type { ArgumentsCamelCase, Argv } from "yargs";
import { hideBin } from "yargs/helpers";
import pkg from "../package.json";
import {
  commitCommandSchema,
  executeCommitCommand,
} from "./commands/commit-command";
import {
  createPrCommandSchema,
  executeCreatePrCommand,
} from "./commands/create-pr-command";
import { CommandError } from "./commands/error";
import {
  executeIndexCommand as executeReindexCommand,
  indexCommandSchema,
} from "./commands/index-command";
import {
  executeShowConfigCommand,
  showConfigValuesSchema,
} from "./commands/show-config";

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .command(
      "review [pattern]",
      "Review code",
      (yargs: Argv) => {
        return yargs
          .positional("pattern", {
            describe: "Search pattern",
            type: "string",
          })
          .option("dir", {
            type: "string",
            description: "Target directory path",
          })
          .option("slack", {
            type: "boolean",
            description: "Send notification to Slack",
          });
      },
      async (argv: ArgumentsCamelCase) => {
        const reviewValues = reviewCommandSchema.parse({
          dir: argv.dir,
          slack: argv.slack,
          pattern: argv.pattern,
        });
        await executeReviewCommand(reviewValues);
      },
    )
    .command(
      "commit-message",
      "Generate commit message based on diff from HEAD",
      (yargs: Argv) => {
        return yargs.option("dir", {
          type: "string",
          description: "Target directory path",
        });
      },
      async (argv: ArgumentsCamelCase) => {
        const commitMessageValues = commitMessageCommandSchema.parse(argv);
        await executeCommitMessageCommand(commitMessageValues);
      },
    )
    .command(
      "summary",
      "Summarize diff from HEAD",
      (yargs: Argv) => {
        return yargs.option("dir", {
          type: "string",
          description: "Target directory path",
        });
      },
      async (argv: ArgumentsCamelCase) => {
        const summaryValues = summaryDiffCommandSchema.parse(argv);
        await executeSummaryDiffCommand(summaryValues);
      },
    )
    .command(
      "commit",
      "Create a commit with auto-generated message",
      (yargs: Argv) => {
        return yargs
          .option("staged", {
            type: "boolean",
            alias: "s",
            description: "Only include staged changes",
          })
          .option("push", {
            type: "boolean",
            alias: "p",
            description: "Push to remote repository",
          })
          .option("dryRun", {
            type: "boolean",
            description: "Show result without execution",
          });
      },
      async (argv: ArgumentsCamelCase) => {
        const commitValues = commitCommandSchema.parse(argv);
        await executeCommitCommand(commitValues);
      },
    )
    .command(
      "create-pr",
      "Create a pull request",
      (yargs: Argv) => {
        return yargs
          .option("withSummary", {
            type: "boolean",
            description: "Generate summary of diff from HEAD",
          })
          .option("body", {
            type: "string",
            alias: "b",
            description: "Pull request body",
            default: "",
          })
          .option("draft", {
            type: "boolean",
            alias: "d",
            description: "Create a draft pull request",
          })
          .option("title", {
            type: "string",
            alias: "t",
            description: "Pull request title",
            default: "",
          })
          .option("branchName", {
            type: "string",
            alias: "n",
            description: "Branch name",
            default: "",
          })
          .option("dryRun", {
            type: "boolean",
            description: "Show result without execution",
          })
          .option("staged", {
            type: "boolean",
            description: "Only include staged changes",
          });
      },
      async (argv: ArgumentsCamelCase) => {
        const createPRValues = createPrCommandSchema.parse(argv);
        await executeCreatePrCommand(createPRValues);
      },
    )
    .command(
      "reindex",
      "Create index for code and documentation",
      {},
      async (argv: ArgumentsCamelCase) => {
        const reindexValues = indexCommandSchema.parse(argv);
        await executeReindexCommand(reindexValues);
      },
    )
    .command(
      "show-config",
      "Show configuration",
      (yargs: Argv) => {
        return yargs.option("default", {
          type: "boolean",
          description: "Show default configuration",
        });
      },
      async (argv: ArgumentsCamelCase) => {
        const showConfigValues = showConfigValuesSchema.parse(argv);
        await executeShowConfigCommand(showConfigValues);
      },
    )
    .command(
      "agent [prompt]",
      "Execute agent commands",
      (yargs: Argv) => {
        return yargs
          .positional("prompt", {
            describe: "Command prompt for the agent",
            type: "string",
          })
          .option("file", {
            type: "string",
            alias: "f",
            description: "path to an instruction file",
          })
          .option("interactive", {
            type: "boolean",
            alias: "i",
            description: "Start in interactive chat mode",
            default: false,
          });
      },
      async (argv: ArgumentsCamelCase) => {
        await executeAgentCommand({
          prompt: argv.prompt as string,
          file: argv.file as string | undefined,
          interactive: argv.interactive as boolean,
        });
      },
    )
    .version(pkg.version)
    .help()
    .demandCommand(1, "Please specify a command")
    .strict().argv;
}

if (import.meta.main) {
  main().catch((error) => {
    if (error instanceof CommandError) {
      console.error(error.message);
      process.exit(1);
    } else {
      console.error(error);
      process.exit(1);
    }
  });
}
