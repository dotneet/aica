export type ToolId =
  | "create_file"
  | "edit_file"
  | "list_files"
  | "search_files"
  | "read_file"
  | "execute_command"
  | "attempt_completion"
  | "stop";

export const validToolIds: ToolId[] = [
  "search_files",
  "create_file",
  "edit_file",
  "list_files",
  "read_file",
  "execute_command",
  "attempt_completion",
  "stop",
];

export function isValidToolId(id: string): id is ToolId {
  return validToolIds.includes(id as ToolId);
}

export interface Action {
  toolId: ToolId;
  params: Record<string, string>;
}

export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}

export type ToolExecutionResult = {
  result: string;
  addedFiles?: Source[];
};

export interface Tool {
  name: ToolId;
  description: string;
  example?: string;
  params: Record<string, { type: string; description: string }>;
  execute(params: Record<string, string>): Promise<ToolExecutionResult>;
}

import { Source } from "@/source";
import {
  CreateFileTool,
  EditFileTool,
  ExecuteCommandTool,
  ListFilesTool,
  ReadFileTool,
  SearchFilesTool,
  StopTool,
  AttemptCompletionTool,
  diffToolPrompt,
} from "./tools";

export const tools: Record<string, Tool> = {
  create_file: new CreateFileTool(),
  edit_file: new EditFileTool(),
  list_files: new ListFilesTool(),
  read_file: new ReadFileTool(),
  execute_command: new ExecuteCommandTool(),
  stop: new StopTool(),
  search_files: new SearchFilesTool(),
  attempt_completion: new AttemptCompletionTool(),
};

function getToolExplanation(tool: Tool): string {
  return `
  ${tool.name}
  Description: ${tool.description}
  Params:
  ${Object.entries(tool.params)
    .map(([key, param]) => ` - ${key}: ${param.type} - ${param.description}`)
    .join("\n")}
  ${tool.example ? `Example:\n${tool.example}` : ""}
  `;
}

export function generateAvailableTools(): string {
  const toolDescriptions = Object.values(tools)
    .map((tool) => getToolExplanation(tool))
    .join("\n---\n");

  return `
=== AVAILABLE TOOLS ===
${toolDescriptions}
=== END OF AVAILABLE TOOLS ===

=== UNIFIED FORMAT DIFF EXPLANATION ===
${diffToolPrompt}
=== END OF UNIFIED FORMAT DIFF EXPLANATION ===

`;
}

export type ActionResult = {
  action: Action;
  result: string;
};

export async function executeTool(
  action: Action,
): Promise<ToolExecutionResult> {
  const tool = tools[action.toolId];
  if (!tool) {
    throw new ToolError(`Unknown tool: ${action.toolId}`);
  }
  return await tool.execute(action.params);
}
