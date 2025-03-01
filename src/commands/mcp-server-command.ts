import { z } from "zod";
import { startMcpServer } from "@/mcp/server";

export const mcpServerCommandSchema = z.object({
  config: z.string().optional(),
});

export type McpServerCommandValues = z.infer<typeof mcpServerCommandSchema>;

export async function executeMcpServerCommand(params: McpServerCommandValues) {
  const values = mcpServerCommandSchema.parse(params);
  await startMcpServer(values.config);
}
