import { LLMSettings } from "config";
import { KnowledgeDatabase } from "./knowledge/database";
import { Source } from "source";

interface GPTResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export type AnalyzeContext = {
  knowledgeTexts: string[];
  knowledgeDatabase: KnowledgeDatabase | null;
  llmSettings: LLMSettings;
  systemPrompt: string;
  rules: string[];
  userPrompt: string;
};

export function buildAnalyzeContext(
  knowledgeTexts: string[],
  knowledgeDatabase: KnowledgeDatabase | null,
  llmSettings: LLMSettings,
  systemPrompt: string,
  rules: string[],
  userPrompt: string
): AnalyzeContext {
  return {
    knowledgeTexts,
    knowledgeDatabase,
    llmSettings,
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
  const rules = context.rules;
  const knowledges =
    (await context.knowledgeDatabase?.search(source.content, 5)) ?? [];
  const knowledgeTextFromDb = knowledges
    .filter((k) => k.path !== source.path) // Exclude the same file
    .map((k) => {
      return `## path:${k.path}\n${k.content}`;
    })
    .join("\n\n");

  const knowledgeText =
    [...context.knowledgeTexts].join("\n\n") + knowledgeTextFromDb;

  const systemPrompt = generateSystemPrompt(context.systemPrompt, rules);
  const prompt = generatePromptWithCode(
    source,
    context.userPrompt,
    knowledgeText
  );

  try {
    const response = await fetchOpenAIResponse(
      context.llmSettings.openAiApiKey,
      context.llmSettings.model,
      systemPrompt,
      prompt
    );
    return buildIssuesFromResponse(source, response);
  } catch (error) {
    console.error("Error:", error);
    return [];
  }
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

async function fetchOpenAIResponse(
  openaiApiKey: string,
  model: string,
  systemPrompt: string,
  prompt: string
): Promise<GPTResponse> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });
  return response.json();
}

function buildIssuesFromResponse(
  source: Source,
  response: GPTResponse
): Issue[] {
  const issues = JSON.parse(response.choices[0].message.content)
    .issues as ResponseIssue[];
  return issues.map((issue) => ({
    ...issue,
    source,
  }));
}
