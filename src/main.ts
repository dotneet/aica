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

const argv = yargs(process.argv.slice(2))
  .option("config", {
    describe: "設定ファイルのパス",
    type: "string",
  })
  .command("reviews [<pattern>]", "レビューの実行", (yargs: any) => {
    return yargs
      .option("repository", {
        describe: "リポジトリのパス",
        type: "string",
      })
      .option("dir", {
        describe: "ディレクトリのパス",
        type: "string",
      })
      .option("slack", {
        describe: "Slackに通知するかどうか",
        type: "boolean",
      })
      .positional("pattern", {
        describe: "検索パターン",
        type: "string",
      });
  })
  .strict()
  .help()
  .parse();

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
  default:
    console.error("Unknown subcommand:", subcommand);
}
