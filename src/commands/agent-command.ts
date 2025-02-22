import { z } from "zod";
import { readConfig } from "@/config";
import { Agent } from "@/agent/agent";
import { createLLM } from "@/llm/mod";
import { GitRepository } from "@/git";
import { executeTool } from "@/agent/tool/tool";

export const agentCommandSchema = z.object({
  prompt: z.string().optional(),
  file: z.string().optional(),
});

export type AgentCommandValues = z.infer<typeof agentCommandSchema>;

export async function executeAgentCommand(params: any) {
  const values = agentCommandSchema.parse(params);
  let prompt = values.prompt || "";
  if (values.file) {
    const file = await Bun.file(values.file).text();
    prompt = `${prompt}\n\n${file}`;
  }
  if (prompt === "") {
    throw new Error("Prompt is required");
  }

  const config = await readConfig();
  const llm = createLLM(config.llm);
  const gitRepository = new GitRepository(process.cwd());
  const agent = new Agent(gitRepository, llm);
  await agent.startTask(prompt, {
    maxIterations: 25,
    verbose: Bun.env.AICA_VERBOSE === "true",
  });
}
