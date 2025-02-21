import { z } from "zod";
import { readConfig } from "@/config";
import { Agent } from "@/agent/agent";
import { createLLM } from "@/llm/mod";
import { GitRepository } from "@/git";
import { executeTool } from "@/agent/tool/tool";

export const agentCommandSchema = z.object({
  prompt: z.string(),
});

export type AgentCommandValues = z.infer<typeof agentCommandSchema>;

export async function executeAgentCommand(args: string[]) {
  const values = agentCommandSchema.parse({
    prompt: args.join(" "),
  });

  const config = await readConfig();
  const llm = createLLM(config.llm);
  const gitRepository = new GitRepository(process.cwd());
  const agent = new Agent(gitRepository, llm);
  await agent.startTask(values.prompt, {
    maxIterations: 25,
    verbose: Bun.env.AICA_VERBOSE === "true",
  });
}
