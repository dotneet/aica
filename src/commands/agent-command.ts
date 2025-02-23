import { z } from "zod";
import { readConfig } from "@/config";
import { Agent } from "@/agent/agent";
import { createLLM } from "@/llm/mod";
import { GitRepository } from "@/git";
import * as readline from "node:readline";

export const agentCommandSchema = z.object({
  prompt: z.string().optional(),
  file: z.string().optional(),
});

export type AgentCommandValues = z.infer<typeof agentCommandSchema>;

export async function executeAgentCommand(params: any) {
  const values = agentCommandSchema.parse(params);
  let prompt = values.prompt || "";
  const config = await readConfig();
  const llm = createLLM(config.llm);
  const gitRepository = new GitRepository(process.cwd());
  const agent = new Agent(gitRepository, llm, config.rules);
  const isInteractiveMode = prompt === "";

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

    console.log("Starting interactive agent mode");
    console.log("Enter your prompt (press Enter twice to submit)");
    while (true) {
      const input = (await readUserInput()).trim();
      if (input.toLowerCase() === "exit") {
        console.log("Exiting interactive mode");
        break;
      }
      console.log("Starting task...");
      try {
        await executePrompt(input);
        console.log(
          "\nEnter your prompt (press Enter twice to submit, type 'exit' to end):",
        );
      } catch (error: any) {
        console.error("An error occurred:", error?.message || "Unknown error");
        console.log(
          "\nEnter your prompt (press Enter twice to submit, type 'exit' to end):",
        );
      }
    }
  } else {
    await executePrompt(prompt);
  }
}
