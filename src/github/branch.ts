import type { Config } from "@/config";
import { createLLM } from "@/llm/factory";

export async function createBranchName(
  config: Config,
  diff: string,
): Promise<string> {
  const llm = createLLM(config.llm);

  const systemPrompt = `
  You are a helpful assistant that creates a branch name for a git repository.
  RULES:
   - You must output only JSON format string.
   - JSON has only one property: "branchName".
   - Do not output anything else.
  `;
  const userPrompt = `
  The following is a diff of the changes to the repository:
  ${diff}

  OUTPUT EXAMPLE:
  {"branchName": "feature-add-item"}
  `;
  const result = await llm.generate(
    systemPrompt,
    [{ role: "user", content: userPrompt }],
    true,
  );
  const replaced = result.replace(/^```json\n/, "").replace(/\n```$/, "");
  return JSON.parse(replaced).branchName;
}
