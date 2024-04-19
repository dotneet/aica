import { Config, LLMConfig } from "./config";
import fs from "fs";
import path from "path";
import {
  CodeSearchDatabaseOrama,
  KnowledgeDatabase,
} from "./knowledge/database";
import { Source, SourceType } from "./source";
import { createLLM, LLM } from "./llm/mod";
import { createEmbeddingProducer } from "./embedding/mod";

export type AnalyzeContext = {
  knowledgeTexts: string[];
  codeSearchDatabase: KnowledgeDatabase | null;
  documentSearchDatabase: KnowledgeDatabase | null;
  llm: LLM;
  systemPrompt: string;
  rules: string[];
  userPrompt: string;
};

export async function createAnalyzeContextFromConfig(
  config: Config,
): Promise<AnalyzeContext> {
  const wd = config.workingDirectory;
  const knowledgeTextFiles = config.knowledge?.fixture?.files || [];
  const knowledgeTexts = knowledgeTextFiles.map((f) =>
    fs.readFileSync(path.join(wd, f), "utf8"),
  );

  const embeddingProducer = createEmbeddingProducer(config.embedding);
  let codeSearchDatabase: KnowledgeDatabase | null;
  if (config.knowledge?.codeSearch && config.knowledge.codeSearch.directory) {
    const { directory, persistentFilePath, includePatterns, excludePatterns } =
      config.knowledge.codeSearch;
    const absolutePath = fs.realpathSync(path.join(wd, directory));
    const absolutePersistentFilePath = fs.realpathSync(
      path.join(wd, persistentFilePath),
    );
    codeSearchDatabase = await CodeSearchDatabaseOrama.fromSettings(
      absolutePath,
      absolutePersistentFilePath,
      includePatterns,
      excludePatterns,
      embeddingProducer,
    );
  }

  let documentSearchDatabase: KnowledgeDatabase | null;
  if (
    config.knowledge?.documentSearch &&
    config.knowledge.documentSearch.directory
  ) {
    const { directory, persistentFilePath, includePatterns, excludePatterns } =
      config.knowledge.documentSearch;
    const absolutePath = fs.realpathSync(path.join(wd, directory));
    const absolutePersistentFilePath = fs.realpathSync(
      path.join(wd, persistentFilePath),
    );
    documentSearchDatabase = await CodeSearchDatabaseOrama.fromSettings(
      absolutePath,
      absolutePersistentFilePath,
      includePatterns,
      excludePatterns,
      embeddingProducer,
    );
  }

  return createAnalyzeContext(
    knowledgeTexts,
    codeSearchDatabase,
    documentSearchDatabase,
    config.llm,
    config.review.prompt.system,
    config.review.prompt.rules,
    config.review.prompt.user,
  );
}

export function createAnalyzeContext(
  knowledgeTexts: string[],
  codeSearchDatabase: KnowledgeDatabase | null,
  documentSearchDatabase: KnowledgeDatabase | null,
  llmSettings: LLMConfig,
  systemPrompt: string,
  rules: string[],
  userPrompt: string,
): AnalyzeContext {
  const llm = createLLM(llmSettings);
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
  file: string;
  line: number;
  level: "critical" | "high";
  description: string;
};

export function getCodesAroundIssue(
  issue: Issue,
  numLines: number = 3,
): string {
  const lines = issue.source.contentWithLineNumbers.split("\n");
  const start = Math.max(0, issue.line - numLines);
  const end = Math.min(lines.length, issue.line + numLines);
  return lines.slice(start, end).join("\n");
}

type ResponseIssue = {
  line: number;
  file: string;
  level: "critical" | "high";
  description: string;
};

export async function analyzeCodeForBugs(
  context: AnalyzeContext,
  source: Source,
): Promise<Issue[]> {
  const knowledgeText = await createKnowledgeText(context, source);

  const rules = context.rules;
  const systemPrompt = generateSystemPrompt(context.systemPrompt, rules);
  const prompt = generatePromptWithCode(
    source,
    context.userPrompt,
    knowledgeText,
  );

  try {
    const response = await context.llm.generate(systemPrompt, prompt, true);
    return buildIssuesFromResponse(source, response);
  } catch (error) {
    console.error("Error:", error);
    return [];
  }
}

async function createKnowledgeText(
  context: AnalyzeContext,
  source: Source,
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
      {"line": 5, "file": "hoge.html", "level": "critical", "description": "The attribute target=\"_blank\" must be used in conjunction with rel=\"noreferrer\"."},
      {"line": 10, "file": "foo.js", "level": "high", "description": "The function foo() should use parameter y instead of x."},
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
  knowledgeText: string,
): string {
  const targetSourceContent = source.targetSourceContent;
  if (source.type === SourceType.PullRequestDiff) {
    userPrompt +=
      "\n the target source is diff format. '-' means removed, '+' means added.";
  }

  return `${userPrompt}

  Target Source:
  =====
  %TARGET_SOURCE%
  =====

  You can use the knowledge below to help your task.

  Knowledge:
  =====
  %KNOWLEDGE_TEXT%
  =====
  `
    .replace(/\n +/g, "\n")
    .replace("%TARGET_SOURCE%", targetSourceContent)
    .replace("%KNOWLEDGE_TEXT%", knowledgeText);
}

function buildIssuesFromResponse(source: Source, response: string): Issue[] {
  const issues = JSON.parse(response).issues as ResponseIssue[];
  return issues.map((issue) => ({
    ...issue,
    source,
  }));
}
