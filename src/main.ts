import yargs from "yargs";

import { executeCommitMessageCommand } from "@/commands/commit-message-command";
import { executeReviewCommand } from "@/commands/review-command";
import pkg from "../package.json";
import { executeSummaryDiffCommand } from "@/commands/summary-diff-command";
import { executeCreatePRCommand } from "./commands/create-pr-command";
import { executeCommitCommand } from "./commands/commit-command";
import { CommandError } from "./commands/error";
import {
  executeShowConfigCommand,
  showConfigValuesSchema,
} from "./commands/show-config";

async function main() {
  const argv = yargs(process.argv.slice(2))
    .scriptName("aica")
    .option("config", {
      describe: "path to config file",
      type: "string",
    })
    .version(pkg.version)
    .command(
      "commit-message",
      "generate a commit message based on the diff from HEAD",
      (yargs: any) => {
        return yargs
          .options({
            dir: {
              describe: "path to the target directory",
              type: "string",
            },
          })
          .strict()
          .help();
      },
    )
    .command("summary-diff", "summarize the diff from HEAD", (yargs: any) => {
      return yargs
        .options({
          dir: {
            describe: "path to the target directory",
            type: "string",
          },
        })
        .strict()
        .help();
    })
    .command("review [<pattern>]", "review code", (yargs: any) => {
      return yargs
        .options({
          dir: {
            describe: "path to the target directory",
            type: "string",
          },
          slack: {
            describe: "notify slack",
            type: "boolean",
          },
        })
        .positional("pattern", {
          describe: "search pattern",
          type: "string",
        });
    })
    .command("create-pr", "create a pull request", (yargs: any) => {
      return yargs
        .options({
          dryRun: {
            describe: "dry run",
            type: "boolean",
          },
          staged: {
            describe: "staged changes only",
            type: "boolean",
          },
        })
        .strict()
        .help();
    })
    .command(
      "commit",
      "commit changes with auto-generated message",
      (yargs: any) => {
        return yargs
          .options({
            staged: {
              describe: "staged changes only",
              type: "boolean",
            },
            dryRun: {
              describe: "dry run",
              type: "boolean",
            },
          })
          .strict()
          .help();
      },
    )
    .command("show-config", "show the config", (yargs: any) => {
      return yargs
        .options({
          default: {
            describe: "show the default config",
            type: "boolean",
          },
        })
        .help();
    })
    .demandCommand()
    .parseSync();

  const values = {
    config: argv.config,
    dir: argv.dir,
    slack: argv.slack,
    pattern: argv.pattern,
    dryRun: argv.dryRun || false,
    staged: argv.staged || false,
  };

  const subcommand = argv._[0];
  try {
    switch (subcommand) {
      case "review":
        await executeReviewCommand(values);
        break;
      case "commit-message":
        await executeCommitMessageCommand(values);
        break;
      case "summary-diff":
        await executeSummaryDiffCommand(values);
        break;
      case "commit":
        await executeCommitCommand(values);
        break;
      case "create-pr":
        await executeCreatePRCommand(values);
        break;
      case "show-config":
        const showConfigValues = showConfigValuesSchema.parse(argv);
        await executeShowConfigCommand(showConfigValues);
        break;
      default:
        console.error("Unknown subcommand:", subcommand);
    }
  } catch (error) {
    if (error instanceof CommandError) {
      console.error(error.message);
    } else {
      throw error;
    }
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
