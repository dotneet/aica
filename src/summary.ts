import { LLM } from "./llm/mod";

export type SummaryContext = {
  llm: LLM;
  systemPrompt: string;
  rules: string[];
  userPrompt: string;
};

export type SummaryDiffItem = {
  category: string;
  description: string;
};

export function createSummaryContext(
  llm: LLM,
  systemPrompt: string,
  rules: string[],
  userPrompt: string,
): SummaryContext {
  return {
    llm,
    systemPrompt,
    rules,
    userPrompt,
  };
}

export async function summarizeDiff(
  context: SummaryContext,
  source: string,
): Promise<SummaryDiffItem[]> {
  const systemPrompt = `${context.systemPrompt}

    RULES:
    ${context.rules.map((rule) => `- ${rule}`).join("\n")}

    'category' property must be one of the following:
     - refactor: typo, improvement of the code without changing its behavior
     - bugfix: bug fix
     - feature: new functionality
     - enhance: improvements with change its behavior, optimization, trivial new functionality, CI/CD
     - docs: documentation, code comments

    JSON Format:'''
    {
        "changes":[
            {"category": "refactor", "description": "Refactor the code to improve readability and maintainability."},
            {"category": "bugfix", "description": "resolve the usage of undeclared variable 'i'."},
            {"category": "feature", "description": "add the new command 'summary'"},
            {"category": "enhance", "description": "optimize calc() for better performance."},
            {"category": "docs", "description": "Add the explanation about the new command 'summary' to README.md."}
        ]
    }
    '''`.replace(/^ +/gm, "");

  const userPrompt = `${context.userPrompt}`.replace("%CODE%", source);
  const result = await context.llm.generate(systemPrompt, userPrompt, true);
  try {
    const replaced = result.replace(/^```json\n/, "").replace(/\n```$/, "");
    const json = JSON.parse(replaced);
    return json.changes.map((change: any) => ({
      category: change.category,
      description: change.description,
    }));
  } catch (e) {
    console.error(e.message + "\nRESULT:\n" + result);
    throw new Error("Failed to parse summary");
  }
}
