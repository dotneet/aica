import { toPosixPath } from "@/utility/path";
import { readdirSync } from "fs";
import os from "os";
import osName from "os-name";

function getShellFromEnv(): string | null {
  const { env } = process;

  if (process.platform === "win32") {
    // On Windows, COMSPEC typically holds cmd.exe
    return env.COMSPEC || "C:\\Windows\\System32\\cmd.exe";
  }

  if (process.platform === "darwin") {
    // On macOS/Linux, SHELL is commonly the environment variable
    return env.SHELL || "/bin/zsh";
  }

  if (process.platform === "linux") {
    // On Linux, SHELL is commonly the environment variable
    return env.SHELL || "/bin/bash";
  }
  return null;
}

export function getSystemInfoSection(cwd: string): string {
  let details = `====
  
  SYSTEM INFORMATION
  
  Operating System: ${osName()}
  Default Shell: ${getShellFromEnv()}
  Home Directory: ${toPosixPath(os.homedir())}
  Current Working Directory: ${toPosixPath(cwd)}
  
  When the user initially gives you a task, a recursive list of all filepaths in the current working directory ('/test/path') will be included in environment_details. This provides an overview of the project's file structure, offering key insights into the project from directory/file names (how developers conceptualize and organize their code) and file extensions (the language used). This can also guide decision-making on which files to explore further. If you need to further explore directories such as outside the current working directory, you can use the list_files tool. If you pass 'true' for the recursive parameter, it will list files recursively. Otherwise, it will list files at the top level, which is better suited for generic directories where you don't necessarily need the nested structure, like the Desktop.`;

  return details;
}

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
