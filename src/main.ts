import yargs from "yargs";

import { executeCommitMessageCommand } from "@/commands/commit-message-command";
import { executeReviewCommand } from "@/commands/review-command";
import pkg from "../package.json";
import { executeSummaryDiffCommand } from "@/commands/summary-diff-command";

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
    }
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
  .strict()
  .help()
  .demandCommand()
  .parseSync();

const values = {
  config: argv.config,
  dir: argv.dir,
  slack: argv.slack,
  pattern: argv.pattern,
};

const subcommand = argv._[0];
switch (subcommand) {
  case "review":
    executeReviewCommand(values);
    break;
  case "commit-message":
    executeCommitMessageCommand(values);
    break;
  case "summary-diff":
    executeSummaryDiffCommand(values);
    break;
  default:
    console.error("Unknown subcommand:", subcommand);
}
