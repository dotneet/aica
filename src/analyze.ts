import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Config, LLMConfig } from "./config";
import { createEmbeddingProducer } from "./embedding/mod";
import {
  CodeSearchDatabaseOrama,
  DocumentSearchDatabaseOrama,
  type KnowledgeDatabase,
} from "./knowledge/database";
import { type LLM, createLLM } from "./llm/mod";
import { type Source, SourceType } from "./source";
import {
  getLanguageFromConfig,
  getLanguagePromptForJson,
} from "./utility/language";

export type AnalyzeContext = {
  knowledgeTexts: string[];
  codeSearchDatabase: KnowledgeDatabase | null;
  documentSearchDatabase: KnowledgeDatabase | null;
  llm: LLM;
  systemPrompt: string;
  rules: string[];
  userPrompt: string;
  language: string;
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
  let codeSearchDatabase: KnowledgeDatabase | null = null;
  if (config.knowledge?.codeSearch?.directory) {
    const { directory, persistentFilePath, includePatterns, excludePatterns } =
      config.knowledge.codeSearch;
    const absolutePath = fs.realpathSync(path.join(wd, directory));
    const absolutePersistentFilePath = path.join(
      fs.realpathSync(wd),
      persistentFilePath,
    );
    codeSearchDatabase = await CodeSearchDatabaseOrama.fromSettings(
      absolutePersistentFilePath,
      absolutePath,
      includePatterns,
      excludePatterns,
      embeddingProducer,
    );
  }

  let documentSearchDatabase: KnowledgeDatabase | null = null;
  if (config.knowledge?.documentSearch?.directory) {
    const { directory, persistentFilePath, includePatterns, excludePatterns } =
      config.knowledge.documentSearch;
    const absolutePath = fs.realpathSync(path.join(wd, directory));
    const absolutePersistentFilePath = path.join(
      fs.realpathSync(wd),
      persistentFilePath,
    );
    documentSearchDatabase = await DocumentSearchDatabaseOrama.fromSettings(
      absolutePersistentFilePath,
      absolutePath,
      includePatterns,
      excludePatterns,
      embeddingProducer,
    );
  }
  const language = getLanguageFromConfig(config);
  return createAnalyzeContext(
    knowledgeTexts,
    codeSearchDatabase,
    documentSearchDatabase,
    config.llm,
    config.review.prompt.system,
    config.review.prompt.rules,
    config.review.prompt.user,
    language,
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
  language: string,
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
    language,
  };
}

export async function reindexAll(context: AnalyzeContext): Promise<boolean> {
  let reindexed = false;
  if (context.codeSearchDatabase) {
    await context.codeSearchDatabase.reindex();
    console.log("codeSearchDatabase reindexed");
    reindexed = true;
  }
  if (context.documentSearchDatabase) {
    await context.documentSearchDatabase.reindex();
    console.log("documentSearchDatabase reindexed");
    reindexed = true;
  }
  return reindexed;
}

export type Issue = {
  source: Source;
  file: string;
  line: number;
  level: "critical" | "high";
  description: string;
};

export function getCodesAroundIssue(issue: Issue, numLines = 3): string {
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
  const language = context.language;
  if (context.language) {
    const languagePrompt = getLanguagePromptForJson(language, ["description"]);
    rules.push(languagePrompt);
  }
  const systemPrompt = generateSystemPrompt(context.systemPrompt, rules);
  const prompt = generatePromptWithCode(
    source,
    context.userPrompt,
    knowledgeText,
  );

  try {
    const response = await context.llm.generate(
      systemPrompt,
      [{ role: "user", content: prompt }],
      true,
      issuesSchema,
    );
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

  const knowledgeText = `${
    [...context.knowledgeTexts].join("\n\n") + knowledgeTextFromDb
  }\n\n${documentKnowledgeTexts}`;

  return knowledgeText.trim();
}

function generateSystemPrompt(systemPrompt: string, rules: string[]): string {
  const rulesString = rules.map((rule) => ` - ${rule}`).join("\n");
  return `
    ${systemPrompt}
    
    Rules:
    %RULES%
  
    You must output the response in JSON format.
    You must not include any other text in your response.

    Response JSON Format:"""
    {"issues": [
      {"line": 5, "file": "hoge.html", "level": "critical", "description": "The attribute target=\"_blank\" must be used in conjunction with rel=\"noreferrer\"."},
      {"line": 10, "file": "foo.js", "level": "high", "description": "The function foo() should use parameter y instead of x."},
    ]}
    """

    Issue type definition:"""
    type Issue = {
      line: number;
      file: string;
      level: "critical" | "high" | "medium" | "low";
      description: string;
    }
    """
    `
    .trim()
    .replace(/\n +/g, "\n")
    .replace("%RULES%", rulesString);
}

const issuesSchema = z.object({
  issues: z.array(
    z.object({
      line: z.number(),
      file: z.string(),
      level: z.enum(["critical", "high", "medium", "low"]),
      description: z.string(),
    }),
  ),
});

function generatePromptWithCode(
  source: Source,
  userPrompt: string,
  knowledgeText: string,
): string {
  const targetSourceContent = source.targetSourceContent;
  let finalUserPrompt = userPrompt;
  const sourceDiff = source.diff;
  let diffSection = "";
  if (
    sourceDiff &&
    source.type === SourceType.PullRequestDiff &&
    source.fileChange
  ) {
    finalUserPrompt +=
      "\n the target source is diff format. '-' means removed, '+' means added.";
    diffSection = `
    Diff:
    =====
    %DIFF_CONTENT%
    =====`.replace("%DIFF_CONTENT%", sourceDiff ?? "");
  }

  return `${finalUserPrompt}

  ${diffSection}

  Target Source:
  =====
  %TARGET_SOURCE%
  =====

  You can use the knowledge below to help your task.

  Knowledge:
  =====
  %KNOWLEDGE_TEXT%
  =====`
    .replace(/\n +/g, "\n")
    .replace("%TARGET_SOURCE%", targetSourceContent)
    .replace("%KNOWLEDGE_TEXT%", knowledgeText);
}

function buildIssuesFromResponse(source: Source, response: string): Issue[] {
  let jsonStr = response;
  if (jsonStr.includes("```json")) {
    jsonStr = response.split("```json")[1].split("```")[0].trim();
  }
  if (jsonStr.indexOf("{") !== 0) {
    const lparentIndex = jsonStr.indexOf("{");
    const rparentIndex = jsonStr.lastIndexOf("}");
    jsonStr = jsonStr.slice(lparentIndex, rparentIndex + 1);
  }
  const issues = JSON.parse(jsonStr).issues as ResponseIssue[];
  return issues.map((issue) => ({
    ...issue,
    source,
  }));
}
