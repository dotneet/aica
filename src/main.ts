import { parseArgs } from "util";
import fs from "node:fs";
import {
  Issue,
  analyzeCodeForBugs,
  createAnalyzeContext,
  createAnalyzeContextFromConfig,
  getCodesAroundIssue,
} from "analyze";
import { sendToSlack } from "slack";
import { Source, SourceFinder } from "source";
import { readConfig } from "config";
import { KnowledgeDatabase, CodeSearchDatabaseOrama } from "knowledge/database";
import { EmbeddingProducer } from "embedding";

const { values, positionals } = parseArgs({
  args: Bun.argv,
  options: {
    config: {
      type: "string",
    },
    repository: {
      type: "string",
    },
    dir: {
      type: "string",
    },
    slack: {
      type: "boolean",
    },
  },
  strict: true,
  allowPositionals: true,
});

async function main(values: any, positionals: any) {
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
    if (positionals.length > 2) {
      sources.push(
        ...(await sourceFinder.getSources(targetDir, positionals[2]))
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

await main(values, positionals);
