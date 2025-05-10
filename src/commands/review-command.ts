import process from "node:process";
import {
  type Issue,
  analyzeCodeForBugs,
  createAnalyzeContextFromConfig,
  getCodesAroundIssue,
} from "@/analyze";
import { readConfig } from "@/config";
import { sendToSlack } from "@/slack";
import { Source, SourceFinder } from "@/source";

import { z } from "zod";
import { GitRepository } from "@/git";
import { parseDiff } from "@/utility/parse-diff";

export const reviewCommandSchema = z.object({
  config: z.string().optional(),
  dir: z.string().optional(),
  slack: z.boolean().optional(),
  pattern: z.string().optional(),
});

export type ReviewCommandValues = z.infer<typeof reviewCommandSchema>;

export async function executeReviewCommand(values: ReviewCommandValues) {
  try {
    const configFilePath = values.config || null;
    const config = await readConfig(configFilePath);
    const targetDir = values.dir || ".";

    const context = await createAnalyzeContextFromConfig(config);

    const sources: Source[] = [];
    const shouldNotifySlack = values.slack === true;

    const sourceFinder = new SourceFinder(
      config.source.includePatterns,
      config.source.excludePatterns,
    );

    if (values.pattern) {
      sources.push(
        ...(await sourceFinder.getSources(targetDir, values.pattern)),
      );
    } else {
      const repositoryDir = values.dir || config.workingDirectory;
      process.chdir(repositoryDir);
      const git = new GitRepository(repositoryDir);
      const diff = await git.getGitDiffFromHead();
      const fileChanges = parseDiff(diff);
      for (const fileChange of fileChanges) {
        sources.push(Source.fromPullRequestDiff(repositoryDir, fileChange));
      }
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
