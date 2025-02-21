import { readdirSync } from "fs";
import { getSystemInfoSection } from "./system-prompt";

export function getEnvironmentDetailsPrompt(cwd: string): string {
  // list all files in the cwd
  const files = readdirSync(cwd);
  const filesString = files.map((file) => `<file>${file}</file>`).join("\n");

  return `
<environment_details>
Running on CI: ${process.env.CI || "false"}
Working Directory: ${cwd}
Top Level Files:
${filesString}
</environment_details>`;
}
