import {
  Tool,
  ToolError,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolId,
} from "../tool";

export class AskFollowupQuestionTool implements Tool {
  name: ToolId = "ask_followup_question";
  description =
    "Ask the user a question to gather additional information needed to complete the task. This tool should be used when you encounter ambiguities, need clarification, or require more details to proceed effectively.";
  params = {
    question: {
      type: "string",
      description:
        "(required) The question to ask the user. This should be a clear, specific question that addresses the information you need.",
    },
  };
  example = `
<ask_followup_question>
<question>What is the path to the frontend-config.json file?</question>
</ask_followup_question>
`.trim();

  async execute(
    context: ToolExecutionContext,
    args: { question: string },
  ): Promise<ToolExecutionResult> {
    if (!args.question) {
      throw new ToolError("Question is required");
    }

    try {
      console.log("Followup question:\n", args.question);
      console.log(
        "\nPlease input additional information. Enter an empty line to submit.\n",
      );
      let result = "";
      const prompt = "> ";
      if (!process.stdout?.isTTY || Bun.env.CI === "true") {
        return {
          result:
            "Not running in a TTY or CI environment, skipping followup question.",
        };
      }
      process.stdout.write(prompt);
      for await (const line of console) {
        if (line.trim() === "") {
          break;
        }
        result += line + "\n";
        process.stdout.write(prompt);
      }
      console.log("Thank you for your input.");
      result = `User answered: ${result}`;
      return {
        result: result,
      };
    } catch (error) {
      if (error instanceof ToolError) throw error;
      if (error instanceof Error) {
        throw new ToolError(
          `Failed to ask followup question: ${error.message}`,
        );
      } else {
        throw new ToolError(`Failed to ask followup question: ${error}`);
      }
    }
  }
}
