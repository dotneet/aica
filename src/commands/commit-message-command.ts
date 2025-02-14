import { createAnalyzeContextFromConfig } from "@/analyze";
import { Config, readConfig } from "@/config";
import { getGitDiffToHead } from "@/git";

export async function executeCommitMessageCommand(values: any) {
  const config = await readConfig(values.config);
  const cwd = values.dir || config.workingDirectory;

  const commitMessage = await createCommitMessage(config, cwd);
  console.log(commitMessage);
}

export async function createCommitMessage(
  config: Config,
  cwd: string,
): Promise<string> {
  // check if cwd is a git repository
  const revParseResult = Bun.spawn({
    cmd: ["git", "rev-parse", "--is-inside-work-tree"],
    cwd,
    stdout: "pipe",
  });
  await revParseResult.exited;
  const isGitRepository = revParseResult.exitCode === 0;
  if (!isGitRepository) {
    throw new Error("Not a git repository.");
  }

  const text = await getGitDiffToHead(cwd);
  if (text === "") {
    throw new Error("No diff found.");
  }

  return createCommitMessageFromDiff(config, text);
}

export async function createCommitMessageFromDiff(
  config: Config,
  diff: string,
): Promise<string> {
  const context = await createAnalyzeContextFromConfig(config);
  const rules = config.commitMessage.prompt.rules
    .map((rule) => `- ${rule}`)
    .join("\n");
  const content = await context.llm.generate(
    config.commitMessage.prompt.system,
    `
    ${config.commitMessage.prompt.user}

    RULES:
    ${rules}

    Response must be JSON syntax.
    The only key in the JSON is "commitMessage".

    JSON EXAMPLE:
    {"commitMessage": "fix: fix the bug"}
    
    === START OF DIFF ===
    %DIFF%
    === END OF DIFF ===
    `
      .replace("\n +", "\n")
      .replace("%DIFF%", diff),
    true,
  );
  const replaced = content.replace(/^```json\n/, "").replace(/\n```$/, "");
  return JSON.parse(replaced).commitMessage;
}
