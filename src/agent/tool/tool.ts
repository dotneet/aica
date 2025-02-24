import type { MCPClientManager } from "@/mcp/client-manager";
import type { Source } from "@/source";
import {
  AskFollowupQuestionTool,
  AttemptCompletionTool,
  CreateFileTool,
  EditFileTool,
  ExecuteCommandTool,
  ListFilesTool,
  ReadFileTool,
  SearchFilesTool,
  diffToolPrompt,
} from "./tools";
import { UseMcpResource, UseMcpTool } from "./tools/mcp";
import { WebFetchTool } from "./tools/web-fetch";

export type ToolId =
  | "create_file"
  | "edit_file"
  | "list_files"
  | "search_files"
  | "read_file"
  | "execute_command"
  | "attempt_completion"
  | "ask_followup_question"
  | "web_fetch"
  | "use_mcp_tool"
  | "use_mcp_resource";

export const validToolIds: ToolId[] = [
  "search_files",
  "create_file",
  "edit_file",
  "list_files",
  "read_file",
  "execute_command",
  "attempt_completion",
  "ask_followup_question",
  "web_fetch",
  "use_mcp_tool",
  "use_mcp_resource",
];

export function isValidToolId(id: string): id is ToolId {
  return validToolIds.includes(id as ToolId);
}

export function initializeTools(): Record<string, Tool> {
  return {
    create_file: new CreateFileTool(),
    edit_file: new EditFileTool(),
    list_files: new ListFilesTool(),
    read_file: new ReadFileTool(),
    execute_command: new ExecuteCommandTool(),
    search_files: new SearchFilesTool(),
    attempt_completion: new AttemptCompletionTool(),
    ask_followup_question: new AskFollowupQuestionTool(),
    web_fetch: new WebFetchTool(),
    use_mcp_tool: new UseMcpTool(),
    use_mcp_resource: new UseMcpResource(),
  };
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

export type ToolExecutionContext = {
  mcpClientManager: MCPClientManager | null;
};

export type ToolExecutionResult = {
  result: string;
  addedFiles?: Source[];
};

export interface Tool {
  name: string;
  description: string;
  example?: string;
  params: Record<string, { type: string; description: string }>;
  execute(
    context: ToolExecutionContext,
    params: Record<string, string>,
  ): Promise<ToolExecutionResult>;
}

export function createToolExecutionContext(
  mcpClientManager: MCPClientManager | null,
): ToolExecutionContext {
  return {
    mcpClientManager,
  };
}

function getToolExplanation(tool: Tool): string {
  return `
ToolId: ${tool.name}
Description: ${tool.description}
Params:
${Object.entries(tool.params)
  .map(([key, param]) => ` - ${key}: ${param.type} - ${param.description}`)
  .join("\n")}
${tool.example ? `Example:\n${tool.example}` : ""}
`.trim();
}

export function generateAvailableTools(tools: Record<string, Tool>): string {
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
  toolExecutionContext: ToolExecutionContext,
  tools: Record<string, Tool>,
  action: Action,
): Promise<ToolExecutionResult> {
  const tool = tools[action.toolId];
  if (!tool) {
    throw new ToolError(`Unknown tool: ${action.toolId}`);
  }
  return await tool.execute(toolExecutionContext, action.params);
}
