import {
  Issue,
  analyzeCodeForBugs,
  createAnalyzeContextFromConfig,
  getCodesAroundIssue,
} from "analyze";
import yargs from "yargs";
import { readConfig } from "config";
import { sendToSlack } from "slack";
import { Source, SourceFinder } from "source";

import pkg from "../package.json";

const argv = yargs(process.argv.slice(2))
  .option("config", {
    describe: "path to config file",
    type: "string",
  })
  .version(pkg.version)
  .command(
    "commit-message",
    "generate commit message based on diff to HEAD",
    (yargs: any) => {
      return yargs
        .options({
          repository: {
            describe: "path to git repository",
            type: "string",
          },
        })
        .strict()
        .help();
    }
  )
  .command("reviews [<pattern>]", "run code review", (yargs: any) => {
    return yargs
      .options({
        repository: {
          describe: "path to git repository",
          type: "string",
        },
        dir: {
          describe: "path to directory",
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
  .parseSync();

async function reviews(values: any) {
  try {
    const configFilePath = values.config || null;
    const config = readConfig(configFilePath);
    const targetDir = values.dir || ".";

    const context = await createAnalyzeContextFromConfig(config);

    const sources: Source[] = [];
    const shouldNotifySlack = values.slack === true;

    const sourceFinder = new SourceFinder(
      config.source.includePatterns,
      config.source.excludePatterns
    );
    if (values.pattern) {
      sources.push(
        ...(await sourceFinder.getSources(targetDir, values.pattern))
      );
    } else {
      const repositoryDir = values.repository || ".";
      sources.push(
        ...(await sourceFinder.getModifiedFilesFromRepository(repositoryDir))
      );
    }

    if (sources.length === 0) {
      console.log("No target files found.");
      return;
    }

    for (const source of sources) {
      console.log(`Analyzing ${source.path}`);
      const issues = await analyzeCodeForBugs(context, source);
      if (issues.length > 0) {
        if (shouldNotifySlack) {
          await sendToSlack(source.path, issues);
          console.log("Slack notification sent.");
        } else {
          console.log(`Issues found in ${source.path}:\n\n`);
          issues.forEach(printIssue);
        }
      } else {
        console.log(`No issues found in ${source.path}.`);
      }
    }
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

async function commitMessage(values: any) {
  // get diff from HEAD
  const result = Bun.spawn({
    cmd: ["git", "diff", "HEAD"],
    cwd: values.repository || ".",
    stdout: "pipe",
  });
  const text = await new Response(result.stdout).text();
  const config = readConfig(values.config);
  const context = await createAnalyzeContextFromConfig(config);
  const content = await context.llm.generate(
    "You are an senior software engineer.",
    `Generate one-line commit message based on given diff.\nResponse must be less than 120 characters.\n\ndiff: \n ${text}`,
    false
  );
  console.log(content);
}

function printIssue(issue: Issue) {
  console.log(`Line ${issue.line} ${issue.level} - ${issue.description}`);
  console.log(getCodesAroundIssue(issue));
  console.log("");
}

const values = {
  config: argv.config,
  repository: argv.repository,
  dir: argv.dir,
  slack: argv.slack,
  pattern: argv.pattern,
};

const subcommand = argv._[0];
switch (subcommand) {
  case "reviews":
    reviews(values);
    break;
  case "commit-message":
    commitMessage(values);
    break;
  default:
    console.error("Unknown subcommand:", subcommand);
}
