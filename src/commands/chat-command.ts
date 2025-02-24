import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { type Config, readConfig } from "@/config";
import { GitRepository } from "@/git";
import { createLLM } from "@/llm/factory";
import type { LLM, Message } from "@/llm/mod";
import { RulesFinder } from "@/llmcontext/rules-finder";
import {
  getEnvironmentDetailsPrompt,
  getSystemInfoSection,
} from "@/llmcontext/system-environment";
import { z } from "zod";

export const chatCommandSchema = z.object({
  prompt: z.string().optional(),
  file: z.string().optional(),
});

export type ChatCommandValues = z.infer<typeof chatCommandSchema>;

async function handleSingleChat(
  llm: LLM,
  config: Config,
  prompt: string,
): Promise<void> {
  const response = await llm.generate(
    config.chat.prompt.system,
    [{ role: "user", content: prompt }],
    false,
  );
  console.log(response);
}

async function handleInteractiveChat(llm: LLM, config: Config): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("Interactive chat mode started (Press Ctrl+C to exit)");

  let baseDir = await GitRepository.getRepositoryRoot(process.cwd());
  if (!baseDir) {
    baseDir = process.cwd();
  }

  const systemPrompt = await buildSystemPrompt(baseDir, config);
  const messages: Message[] = [];
  while (true) {
    const prompt = await new Promise<string>((resolve) => {
      rl.question("> ", resolve);
    });

    if (prompt.toLowerCase() === "exit" || prompt.toLowerCase() === "quit") {
      break;
    }

    messages.push({ role: "user", content: prompt });
    const response = await llm.generate(systemPrompt, messages, false);
    messages.push({ role: "assistant", content: response });

    console.log(`\n${response}\n`);
  }

  rl.close();
}

export async function executeChatCommand(
  values: ChatCommandValues,
): Promise<void> {
  const config = await readConfig();
  const { prompt, file } = values;
  const llm = createLLM(config.llm);

  if (file) {
    try {
      const fileContent = readFileSync(file, "utf-8");
      await handleSingleChat(llm, config, fileContent);
      return;
    } catch (error) {
      throw new Error(`Failed to read file: ${file}`);
    }
  }

  if (prompt) {
    await handleSingleChat(llm, config, prompt);
    return;
  }

  await handleInteractiveChat(llm, config);
}

export async function buildSystemPrompt(
  baseDir: string,
  config: Config,
): Promise<string> {
  const rulesFinder = new RulesFinder(baseDir, config.rules);
  const rules = await rulesFinder.findAllRules();
  const chatSystemPrompt = config.chat.prompt.system;
  const systemInfoSection = getSystemInfoSection(baseDir);
  const environmentDetailsPrompt = getEnvironmentDetailsPrompt(baseDir);
  return `
${chatSystemPrompt}

=== ADDITIONAL CONTEXT ====
${rules.fixedContexts.join("\n===\n")}
${rules.fileRules
  .map((rule) => `${rule.description}\n\n${rule.content}`)
  .join("\n===\n")}

${systemInfoSection}
${environmentDetailsPrompt}
=== END OF ADDITIONAL CONTEXT ====
`;
}
