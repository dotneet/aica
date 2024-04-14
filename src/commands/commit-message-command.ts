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
  const content = await context.llm.generate(
    "You are an senior software engineer.",
    `Generate one-line commit message based on given diff.\nResponse must be less than 80 characters.\n\ndiff: \n ${text}`,
    false
  );
  console.log(content);
}
