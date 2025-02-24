import {
  type Tool,
  ToolError,
  type ToolExecutionContext,
  type ToolExecutionResult,
} from "@/agent/tool/tool";

export class UseMcpTool implements Tool {
  name = "use_mcp_tool";
  description = "call Mool";
  params = {
    serverName: {
      type: "string",
      description: "The name of the MCP server to call",
    },
    toolName: {
      type: "string",
      description: "The name of the MCP tool to call",
    },
    args: {
      type: "object",
      description:
        "The arguments to pass to the tool. this value is JSON format." +
        "restrictly obey the tool's JSON schema.",
    },
  };

  async execute(
    context: ToolExecutionContext,
    params: Record<string, string>,
  ): Promise<ToolExecutionResult> {
    if (!context.mcpClientManager) {
      throw new ToolError("MCP client manager is not set");
    }
    const { serverName, toolName, args } = params;
    const client = context.mcpClientManager.getClient(serverName);
    if (!client) {
      throw new ToolError(`MCP client ${serverName} not found`);
    }
    const result = await client.callTool(toolName, JSON.parse(args));
    return {
      result:
        `MCP tool ${serverName}.${toolName} called successfully.\nResult:\n` +
        `${JSON.stringify(result, null, 2)}`,
    };
  }
}
export class UseMcpResource implements Tool {
  name = "use_mcp_resource";
  description = "get MCP server resource";
  params = {
    serverName: {
      type: "string",
      description: "The name of the MCP server to get resource",
    },
    uri: {
      type: "string",
      description: "The uri of the MCP resource to get",
    },
  };
  async execute(
    context: ToolExecutionContext,
    params: Record<string, string>,
  ): Promise<ToolExecutionResult> {
    if (!context.mcpClientManager) {
      throw new ToolError("MCP client manager is not set");
    }

    const { serverName, uri } = params;
    const client = context.mcpClientManager.getClient(serverName);
    if (!client) {
      throw new ToolError(`MCP client ${serverName} not found`);
    }
    const resource = await client.readResource(uri);
    return {
      result:
        `MCP resource ${uri} read successfully.\nContent:\n` +
        `${JSON.stringify(resource, null, 2)}`,
    };
  }
}
