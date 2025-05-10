import * as readline from "node:readline";
import { Agent } from "@/agent/agent";
import { readConfig } from "@/config";
import { GitRepository } from "@/git";
import { createLLM } from "@/llm/mod";
import { render } from "ink";
import * as React from "react";
import { z } from "zod";
import { Chat, clearConsole } from "../chat-ui";

export const agentCommandSchema = z.object({
  prompt: z.string().optional(),
  file: z.string().optional(),
  interactive: z.boolean().optional().default(false),
});

export type AgentCommandValues = z.infer<typeof agentCommandSchema>;

export async function executeAgentCommand(params: AgentCommandValues) {
  const values = agentCommandSchema.parse(params);
  let prompt = values.prompt || "";
  const config = await readConfig();
  const llm = createLLM(config.llm);
  const gitRepository = new GitRepository(process.cwd());
  await using agent = new Agent(gitRepository, llm, config);
  const isInteractiveMode = prompt === "" || values.interactive;

  if (values.file) {
    const file = await Bun.file(values.file).text();
    prompt = `${prompt}\n\n${file}`;
  }

  async function readUserInput(): Promise<string> {
    const lines: string[] = [];
    const prompt = "> ";
    process.stdout.write(prompt);
    const reader = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    try {
      for await (const line of reader) {
        const hasLine = lines.filter((l) => l !== "").length > 0;
        if (!hasLine && line === "exit") {
          lines.push(line);
          break;
        }
        if (hasLine && line === "") {
          break;
        }
        process.stdout.write(prompt);
        lines.push(line);
      }
    } finally {
      reader.close();
    }
    return lines.join("\n");
  }

  async function executePrompt(input: string) {
    if (input.trim() === "") {
      throw new Error("Prompt is required");
    }
    await agent.startTask(input, {
      maxIterations: 25,
      verbose: Bun.env.AICA_VERBOSE === "true",
    });
  }

  if (isInteractiveMode) {
    if (!process.stdout?.isTTY || Bun.env.CI === "true") {
      throw new Error(
        "Interactive mode is not available in non-TTY or CI environment",
      );
    }

    // Use Chat UI for interactive mode
    clearConsole();
    render(React.createElement(Chat, { agent, config }));

    // Cleanup
    process.on("SIGINT", () => {
      process.exit(0);
    });
  } else {
    await executePrompt(prompt);
  }
}
