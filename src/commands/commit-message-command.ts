import { createAnalyzeContextFromConfig } from "@/analyze";
import { readConfig, type Config } from "@/config";
import { GitRepository } from "@/git";
import { z } from "zod";

export const commitMessageCommandSchema = z.object({
  dryRun: z.boolean().default(false),
});

export type CommitMessageCommandValues = z.infer<
  typeof commitMessageCommandSchema
>;

export async function executeCommitMessageCommand(
  values: CommitMessageCommandValues,
): Promise<void> {
  const config = await readConfig();
  const cwd = process.cwd();
  const commitMessage = await createCommitMessage(config, cwd);
  console.log(commitMessage);
}

export async function createCommitMessage(
  config: Config,
  cwd: string,
): Promise<string> {
  const git = new GitRepository(cwd);
  const text = await git.getGitDiffFromHead();
  if (!text) {
    throw new Error("No changes to commit");
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
  const prompt = `
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
    .replace("%DIFF%", diff);
  const content = await context.llm.generate(
    config.commitMessage.prompt.system,
    [{ role: "user", content: prompt }],
    true,
  );
  const replaced = content.replace(/^```json\n/, "").replace(/\n```$/, "");
  return JSON.parse(replaced).commitMessage;
}
