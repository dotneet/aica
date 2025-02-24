import type { ActionResult } from "./tool";

export type AgentHistoryItemType =
  | "user_prompt"
  | "agent_response"
  | "action_result"
  | "evaluate_action_result";

export type AgentHistoryItem = {
  type: AgentHistoryItemType;
  content: string | ActionResult;
};

/**
 * AgentHistory is a class that stores the history of the agent.
 * It can be converted to a string that can be used as a prompt.
 */
export class AgentHistory {
  private items: AgentHistoryItem[] = [];

  addUserPrompt(prompt: string) {
    this.items.push({
      type: "user_prompt",
      content: prompt,
    });
  }

  addAgentResponse(response: string) {
    this.items.push({
      type: "agent_response",
      content: response,
    });
  }

  addActionResult(actionResult: ActionResult) {
    this.items.push({
      type: "action_result",
      content: actionResult.result,
    });
  }

  addEvaluateActionResult(result: string) {
    this.items.push({
      type: "evaluate_action_result",
      content: result,
    });
  }

  /**
   * Convert the history to a string that can be used as a prompt.
   */
  toPromptString(): string {
    return this.items
      .map((item) => {
        return `${item.type}: ${JSON.stringify(item.content)}`;
      })
      .join("\n------\n");
  }
}
