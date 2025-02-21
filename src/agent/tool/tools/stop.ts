import { Tool, ToolExecutionResult, ToolId } from "../tool";

export class StopTool implements Tool {
  name: ToolId = "stop";
  description = "Stop the agent (no args)";
  params = {
    message: {
      type: "string",
      description: "Optional message to display when stopping",
      optional: true,
    },
  };

  async execute(args: { message: string }): Promise<ToolExecutionResult> {
    // 何もしない
    return {
      result: "",
    };
  }
}
