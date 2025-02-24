import type { LLM } from "./llm/mod";
import { getLanguagePromptForJson } from "./utility/language";

export type SummaryContext = {
  llm: LLM;
  systemPrompt: string;
  rules: string[];
  userPrompt: string;
  language: string;
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
  language: string,
): SummaryContext {
  return {
    llm,
    systemPrompt,
    rules,
    userPrompt,
    language,
  };
}

export async function summarizeDiff(
  context: SummaryContext,
  source: string,
): Promise<SummaryDiffItem[]> {
  const language = context.language;
  const languagePrompt = getLanguagePromptForJson(language, ["description"]);

  const systemPrompt = `${context.systemPrompt}

    RULES:
    ${context.rules.map((rule) => `- ${rule}`).join("\n")}

    'category' property must be one of the following:
     - refactor: typo, improvement of the code without changing its behavior
     - bugfix: bug fix
     - feature: new functionality
     - enhance: improvements with change its behavior, optimization, trivial new functionality, CI/CD
     - docs: documentation, code comments

    ${languagePrompt}

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
  const result = await context.llm.generate(
    systemPrompt,
    [{ role: "user", content: userPrompt }],
    true,
  );
  try {
    const replaced = result
      .trim()
      .replace(/^```json\n/, "")
      .replace(/\n```$/, "");
    const json = JSON.parse(replaced);
    return json.changes.map((change: SummaryDiffItem) => ({
      category: change.category,
      description: change.description,
    }));
  } catch (e) {
    if (e instanceof Error) {
      console.error(`${e.message}\nRESULT:\n${result}`);
    } else {
      console.error(`${e}\nRESULT:\n${result}`);
    }
    throw new Error("Failed to parse summary");
  }
}
