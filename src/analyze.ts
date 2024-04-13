import { LLMConfig } from "config";
import { KnowledgeDatabase } from "./knowledge/database";
import { Source } from "source";
import { LLM } from "llm";

export type AnalyzeContext = {
  knowledgeTexts: string[];
  codeSearchDatabase: KnowledgeDatabase | null;
  documentSearchDatabase: KnowledgeDatabase | null;
  llm: LLM;
  systemPrompt: string;
  rules: string[];
  userPrompt: string;
};

export function buildAnalyzeContext(
  knowledgeTexts: string[],
  codeSearchDatabase: KnowledgeDatabase | null,
  documentSearchDatabase: KnowledgeDatabase | null,
  llmSettings: LLMConfig,
  systemPrompt: string,
  rules: string[],
  userPrompt: string
): AnalyzeContext {
  const llm = new LLM(llmSettings.apiKey, llmSettings.model);
  return {
    knowledgeTexts,
    codeSearchDatabase,
    documentSearchDatabase,
    llm,
    systemPrompt,
    rules,
    userPrompt,
  };
}

export type Issue = {
  source: Source;
  line: number;
  level: "critical" | "high";
  description: string;
};

export function getCodesAroundIssue(
  issue: Issue,
  numLines: number = 3
): string {
  const lines = issue.source.contentWithLineNumbers.split("\n");
  const start = Math.max(0, issue.line - numLines);
  const end = Math.min(lines.length, issue.line + numLines);
  return lines.slice(start, end).join("\n");
}

type ResponseIssue = {
  line: number;
  level: "critical" | "high";
  description: string;
};

export async function analyzeCodeForBugs(
  context: AnalyzeContext,
  source: Source
): Promise<Issue[]> {
  const knowledgeText = await createKnowledgeText(context, source);

  const rules = context.rules;
  const systemPrompt = generateSystemPrompt(context.systemPrompt, rules);
  const prompt = generatePromptWithCode(
    source,
    context.userPrompt,
    knowledgeText
  );

  try {
    const response = await context.llm.generate(systemPrompt, prompt);
    return buildIssuesFromResponse(source, response);
  } catch (error) {
    console.error("Error:", error);
    return [];
  }
}

async function createKnowledgeText(
  context: AnalyzeContext,
  source: Source
): Promise<string> {
  const codeKnowledges =
    (await context.codeSearchDatabase?.search(source.content, 3)) ?? [];

  const knowledgeTextFromDb = codeKnowledges
    .filter((k) => k.path !== source.path) // Exclude the same file
    .map((k) => {
      return `## path:${k.path}\n${k.content}`;
    })
    .join("\n\n");

  const documentKnowledges =
    (await context.documentSearchDatabase?.search(source.content, 3)) ?? [];

  const documentKnowledgeTexts = documentKnowledges
    .map((k) => {
      return `## path:${k.path}\n${k.content}`;
    })
    .join("\n\n");

  const knowledgeText =
    [...context.knowledgeTexts].join("\n\n") +
    knowledgeTextFromDb +
    "\n\n" +
    documentKnowledgeTexts;

  return knowledgeText;
}

function generateSystemPrompt(systemPrompt: string, rules: string[]): string {
  const rulesString = rules.map((rule) => ` - ${rule}`).join("\n");
  return `
    ${systemPrompt}
    
    Rules:
    %RULES%
  
    Response JSON Format:"""
    {"issues": [
      {"line": 5, "level": "critical", "description": "The attribute target=\"_blank\" must be used in conjunction with rel=\"noreferrer\"."},
      {"line": 10, "level": "high", "description": "The function foo() should use parameter y instead of x."},
    ]}
    """

    Issue type definition:"""
    type Issue = {
      line: number;
      level: "critical" | "high";
      description: string;
    }
    """
    `
    .trim()
    .replace(/\n +/g, "\n")
    .replace("%RULES%", rulesString);
}

function generatePromptWithCode(
  source: Source,
  userPrompt: string,
  knowledgeText: string
): string {
  const codeWithLineNumbers = source.contentWithLineNumbers;
  return `${userPrompt}

  Target Source:
  =====
  ${codeWithLineNumbers}
  Please list each issue along with a brief explanation of why it is considered a critical bug:

  Target Source:
  =====
  ${codeWithLineNumbers}
  =====

  You can use the knowledge below to help your task.

  Knowledge:
  =====
  ${knowledgeText}
  =====
  `;
}

function buildIssuesFromResponse(source: Source, response: string): Issue[] {
  const issues = JSON.parse(response).issues as ResponseIssue[];
  return issues.map((issue) => ({
    ...issue,
    source,
  }));
}
