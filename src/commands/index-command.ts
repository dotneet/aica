import { createAnalyzeContextFromConfig, reindexAll } from "@/analyze";
import { readConfig } from "@/config";

export async function executeIndexCommand(values: any) {
  const config = await readConfig(values.config);
  const context = await createAnalyzeContextFromConfig(config);
  const reindexed = await reindexAll(context);
  if (reindexed) {
    console.log("Reindexed all databases");
  } else {
    console.log("No databases to reindex");
  }
}
