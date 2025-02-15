import { createAnalyzeContextFromConfig, reindexAll } from "@/analyze";
import { readConfig } from "@/config";
import { z } from "zod";

export const indexCommandSchema = z.object({
  config: z.string().optional(),
});

export type IndexCommandValues = z.infer<typeof indexCommandSchema>;

export async function executeIndexCommand(values: IndexCommandValues) {
  const config = await readConfig(values.config);
  const context = await createAnalyzeContextFromConfig(config);
  const reindexed = await reindexAll(context);
  if (reindexed) {
    console.log("Reindexed all databases");
  } else {
    console.log("No databases to reindex");
  }
}
