import { z } from "zod";
import { defaultConfig, readConfig } from "../config";

export const showConfigValuesSchema = z.object({
  config: z.string().optional(),
  default: z.boolean().default(false),
});

export type ShowConfigValues = z.infer<typeof showConfigValuesSchema>;

export async function executeShowConfigCommand(values: ShowConfigValues) {
  let config = defaultConfig;
  if (!values.default) {
    config = await readConfig(values.config);
  }
  const toml = JSON.stringify(config, null, 2);
  console.log(toml);
}
