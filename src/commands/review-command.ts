import {
  Issue,
  analyzeCodeForBugs,
  createAnalyzeContextFromConfig,
  getCodesAroundIssue,
} from "@/analyze";
import { readConfig } from "@/config";
import { sendToSlack } from "@/slack";
import { Source, SourceFinder } from "@/source";

export async function executeReviewCommand(values: any) {
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
      const repositoryDir = values.dir || ".";
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
