import { readConfig } from "config";
import { getGitDiff } from "git";
import { LLM } from "llm";
import { SourceFinder } from "source";
import { createSummaryContext, summarizeCode } from "summary";

export async function executeSummaryCommand(values: any) {
  const configFilePath = values.config || null;
  const targetDir = values.dir || ".";
  const pattern = values.pattern;

  const config = await readConfig(configFilePath);

  const summaryContext = createSummaryContext(
    new LLM(config.llm.apiKey, config.llm.model),
    config.summary.prompt.system,
    config.summary.prompt.rules,
    config.summary.prompt.user
  );

  const sourceFinder = new SourceFinder(
    config.source.includePatterns,
    config.source.excludePatterns
  );

  let targetSource = "";
  if (pattern) {
    const sources = await sourceFinder.getSources(targetDir, pattern);
    targetSource = sources
      .map((source) => {
        `=====\npath: ${source.path}\n${source.content}`;
      })
      .join("\n\n");
  } else {
    targetSource = await getGitDiff(targetDir);
  }

  if (targetSource.length === 0) {
    console.log("対象のファイルが見つかりませんでした。");
    return;
  }

  const summary = await summarizeCode(summaryContext, targetSource);
  console.log(`${summary}`);
}
