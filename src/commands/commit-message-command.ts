import { createAnalyzeContextFromConfig } from "@/analyze";
import { readConfig } from "@/config";
import { getGitDiff } from "@/git";

export async function executeCommitMessageCommand(values: any) {
  const cwd = values.dir || ".";
  // check if cwd is a git repository
  const revParseResult = Bun.spawn({
    cmd: ["git", "rev-parse", "--is-inside-work-tree"],
    cwd,
    stdout: "pipe",
  });
  await revParseResult.exited;
  const isGitRepository = revParseResult.exitCode === 0;
  if (!isGitRepository) {
    console.error("Not a git repository.");
    return;
  }

  const text = await getGitDiff(cwd);
  if (text === "") {
    console.log("No diff found.");
    return;
  }
  const config = readConfig(values.config);
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
    
    === START OF DIFF ===
    %DIFF%
    === END OF DIFF ===
    `
      .replace("\n +", "\n")
      .replace("%DIFF%", text),
    false,
  );
  console.log(content);
}
