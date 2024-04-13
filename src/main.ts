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
import { KnowledgeDatabase, KnowledgeDatabaseOrama } from "knowledge/database";
import { EmbeddingProducer } from "embedding";

const { values, positionals } = parseArgs({
  args: Bun.argv,
  options: {
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
    const config = readConfig();
    const targetDir = values.dir || ".";

    let db: KnowledgeDatabase | null;
    const embeddingProducer = new EmbeddingProducer(
      config.llm.openAiApiKey,
      config.llm.embeddingModel
    );
    const knowledgeTextFiles = config.knowledge?.fixture?.files || [];
    const knowledgeTexts = knowledgeTextFiles.map((f) =>
      fs.readFileSync(f, "utf8")
    );
    if (config.knowledge?.search && config.knowledge.search.directory) {
      const { directory, glob, persistentFilePath, excludePatterns } =
        config.knowledge.search;
      if (fs.existsSync(persistentFilePath)) {
        db = await KnowledgeDatabaseOrama.load(
          persistentFilePath,
          embeddingProducer
        );
      } else {
        db = await KnowledgeDatabaseOrama.create(embeddingProducer);
        await db.populate(directory, glob, excludePatterns);
        if (persistentFilePath) {
          await db.save(persistentFilePath);
          console.warn(
            "skip saving knowledge database due to the lack of persistentFilePath in the config."
          );
        }
        console.log("Knowledge database populated.");
      }
    }
    const context = buildAnalyzeContext(
      knowledgeTexts,
      db,
      config.llm,
      config.prompt.system,
      config.prompt.rules,
      config.prompt.user
    );

    const sources: Source[] = [];
    const shouldNotifySlack = values.slack === true;

    const sourceFinder = new SourceFinder(
      config.source.includeSuffixPatterns,
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
