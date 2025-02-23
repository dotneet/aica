import { toPosixPath } from "@/utility/path";
import { readdirSync, statSync, existsSync, readFileSync } from "fs";
import os from "os";
import osName from "os-name";
import { join, relative } from "path";

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
  const { files: absolutePathFiles, didHitLimit } = listFiles(cwd, 200);
  const relativePathFiles = absolutePathFiles.map((file) =>
    relative(cwd, file),
  );
  const filesString = relativePathFiles
    .map((file) => `<file>${file}</file>`)
    .join("\n");

  return `
<environment_details>
Running on CI: ${process.env.CI || "false"}
Working Directory: ${cwd}
<files>
${filesString}
</files>
${
  didHitLimit
    ? "The list of files was truncated. Use list_files on specific subdirectories if you need to explore further."
    : ""
}
</environment_details>`;
}

const defaultIgnorePatterns = [
  "node_modules",
  "dist",
  "build",
  "coverage",
  "logs",
  "tmp",
  "cache",
  "temp",
  "bundle",
  "vendor",
  "out",
  "__pycache__",
  "venv",
  ".venv",
  ".gitignore",
  ".git",
  ".DS_Store",
  ".vscode",
  ".idea",
  ".env",
  ".env.*",
];

export function composeIgnorePatterns(
  cwd: string,
  defaultIgnorePatterns: string[],
): { pattern: string; isNegative: boolean }[] {
  const combinedPatterns: { pattern: string; isNegative: boolean }[] = [];

  // 1. First, add defaultIgnorePatterns
  for (const p of defaultIgnorePatterns) {
    combinedPatterns.push({ pattern: p, isNegative: false });
  }

  // 2. If .gitignore exists, read and add its patterns
  const gitignorePath = join(cwd, ".gitignore");
  if (existsSync(gitignorePath)) {
    const gitignoreContent = readFileSync(gitignorePath, "utf-8");
    combinedPatterns.push(
      ...gitignoreContent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((pattern) => ({
          pattern: pattern.startsWith("!") ? pattern.slice(1) : pattern,
          isNegative: pattern.startsWith("!"),
        })),
    );
  }

  return combinedPatterns;
}

export function matchesAnyIgnorePattern(
  combinedPatterns: { pattern: string; isNegative: boolean }[],
  normalizedRelativePath: string,
): boolean {
  let isIgnored = false;

  for (const { pattern, isNegative } of combinedPatterns) {
    if (matchGitignorePattern(pattern, normalizedRelativePath)) {
      if (isNegative) {
        isIgnored = false;
      } else {
        isIgnored = true;
      }
    }
  }
  return isIgnored;
}

export function matchGitignorePattern(pattern: string, path: string): boolean {
  let regexPattern = pattern;
  regexPattern = regexPattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  regexPattern = regexPattern.replace(/\*\*/g, "{{GLOBSTAR}}");
  regexPattern = regexPattern.replace(/\*/g, "[^/]*");
  regexPattern = regexPattern.replace(/{{GLOBSTAR}}/g, ".*");

  if (pattern.startsWith("/")) {
    regexPattern = `^${regexPattern.slice(1)}`;
  } else if (pattern.endsWith("/")) {
    regexPattern = `(^|.*/)${regexPattern}.*$`;
  } else if (pattern.includes("/")) {
    regexPattern = `(^|.*/)${regexPattern}(/.*)?$`;
  } else {
    regexPattern = `(^|.*/)(${regexPattern})(/.*)?$`;
  }

  try {
    const regex = new RegExp(regexPattern);
    return regex.test(path);
  } catch (error) {
    console.error(`Invalid regex pattern: ${regexPattern}`, error);
    return false;
  }
}

export type ListFilesResult = {
  files: string[];
  didHitLimit: boolean;
};
export function listFiles(cwd: string, limit: number): ListFilesResult {
  const result: string[] = [];
  // composeIgnorePatterns に切り出した
  const combinedPatterns = composeIgnorePatterns(cwd, defaultIgnorePatterns);

  function shouldIgnore(path: string): boolean {
    const relativePath = relative(cwd, path);
    if (!relativePath) return false;

    const normalizedRelativePath = relativePath.replace(/\\/g, "/");
    return matchesAnyIgnorePattern(combinedPatterns, normalizedRelativePath);
  }

  function traverseDirectory(currentPath: string): boolean {
    if (result.length >= limit) return true;

    try {
      const entries = readdirSync(currentPath);
      const sortedEntries = entries.sort();

      for (const entry of sortedEntries) {
        if (result.length >= limit) break;

        const fullPath = join(currentPath, entry);
        const stats = statSync(fullPath);

        // Directory: we go inside even if it matches ignore patterns, because some files could be excluded from ignore by a negative pattern
        if (stats.isDirectory()) {
          traverseDirectory(fullPath);
        } else if (stats.isFile()) {
          // File: we check the ignore pattern here
          if (shouldIgnore(fullPath)) continue;
          result.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${currentPath}:`, error);
    }
    return false;
  }

  const didHitLimit = traverseDirectory(cwd);
  return {
    files: result,
    didHitLimit,
  };
}
