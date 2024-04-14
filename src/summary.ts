import { LLM } from "./llm";

export type SummaryContext = {
  llm: LLM;
  systemPrompt: string;
  rules: string[];
  userPrompt: string;
};

export function createSummaryContext(
  llm: LLM,
  systemPrompt: string,
  rules: string[],
  userPrompt: string
): SummaryContext {
  return {
    llm,
    systemPrompt,
    rules,
    userPrompt,
  };
}

export async function summarizeCode(
  context: SummaryContext,
  source: string
): Promise<string> {
  const systemPrompt = `${context.systemPrompt}

    RULES:
    ${context.rules.join("\n")}

    JSON Format:'''
    {
        "changes":[
            {"category": "refactoring", "description": "Refactor the code to improve readability and maintainability."},
            {"category": "bugfix", "description": "resolve the usage of undeclared variable 'i'."},
            {"category": "feature", "description": "add the new command 'summary'"},
            {"category": "enhancement", "description": "optimize calc() for better performance."}
        ]
    }
    '''`.replace(/^ +/gm, "");

  const userPrompt = `${context.userPrompt}`.replace("%CODE%", source);
  const result = await context.llm.generate(systemPrompt, userPrompt, true);
  const json = JSON.parse(result);
  return json.changes
    .map((change: any) => ` - ${change.category}: ${change.description}`)
    .join("\n");
}
