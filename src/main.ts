import { parseArgs } from "util";
import fs from "node:fs";
import {
  Issue,
  analyzeCodeForBugs,
  buildAnalyzeContext,
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

    const knowledgeTextFiles = config.knowledge?.fixture?.files || [];
    const knowledgeTexts = knowledgeTextFiles.map((f) =>
      fs.readFileSync(f, "utf8")
    );

    const embeddingProducer = new EmbeddingProducer(
      config.llm.apiKey,
      config.llm.embeddingModel
    );
    let codeSearchDatabase: KnowledgeDatabase | null;
    if (config.knowledge?.codeSearch && config.knowledge.codeSearch.directory) {
      const {
        directory,
        persistentFilePath,
        includePatterns,
        excludePatterns,
      } = config.knowledge.codeSearch;
      codeSearchDatabase = await CodeSearchDatabaseOrama.fromSettings(
        directory,
        persistentFilePath,
        includePatterns,
        excludePatterns,
        embeddingProducer
      );
    }

    let documentSearchDatabase: KnowledgeDatabase | null;
    if (
      config.knowledge?.documentSearch &&
      config.knowledge.documentSearch.directory
    ) {
      const {
        directory,
        persistentFilePath,
        includePatterns,
        excludePatterns,
      } = config.knowledge.documentSearch;
      documentSearchDatabase = await CodeSearchDatabaseOrama.fromSettings(
        directory,
        persistentFilePath,
        includePatterns,
        excludePatterns,
        embeddingProducer
      );
    }

    const context = buildAnalyzeContext(
      knowledgeTexts,
      codeSearchDatabase,
      documentSearchDatabase,
      config.llm,
      config.prompt.system,
      config.prompt.rules,
      config.prompt.user
    );

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
