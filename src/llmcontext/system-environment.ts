import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import os from "node:os";
import { join, relative } from "node:path";
import { toPosixPath } from "@/utility/path";
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
  const details = `====
  
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

export function matchGitignorePattern(pattern: string, path: string): boolean {
  let regexPattern = pattern;
  regexPattern = regexPattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  regexPattern = regexPattern.replace(/\*\*/g, "{{GLOBSTAR}}");
  regexPattern = regexPattern.replace(/\*/g, "[^/]*");
  regexPattern = regexPattern.replace(/{{GLOBSTAR}}/g, ".*");

  // If the pattern starts with a slash, it must match the beginning of the path
  if (pattern.startsWith("/")) {
    regexPattern = `^${regexPattern.slice(1)}`;
  }
  // If the pattern ends with a slash, it represents a directory
  else if (pattern.endsWith("/")) {
    regexPattern = `(^|.*/)${regexPattern}.*$`;
  }
  // If the pattern contains a slash, it is treated as part of the path
  else if (pattern.includes("/")) {
    regexPattern = `(^|.*/)${regexPattern}(/.*)?$`;
  }
  // Otherwise, it is treated as a filename or directory name
  else {
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

// Map to cache regular expressions
const regexCache = new Map<string, RegExp>();

// Cached version of matchGitignorePattern
function matchGitignorePatternCached(pattern: string, path: string): boolean {
  let regex = regexCache.get(pattern);

  if (!regex) {
    let regexPattern = pattern;
    regexPattern = regexPattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    regexPattern = regexPattern.replace(/\*\*/g, "{{GLOBSTAR}}");
    regexPattern = regexPattern.replace(/\*/g, "[^/]*");
    regexPattern = regexPattern.replace(/{{GLOBSTAR}}/g, ".*");

    // If the pattern starts with a slash, it must match the beginning of the path
    if (pattern.startsWith("/")) {
      regexPattern = `^${regexPattern.slice(1)}`;
    }
    // If the pattern ends with a slash, it represents a directory
    else if (pattern.endsWith("/")) {
      regexPattern = `(^|.*/)${regexPattern}.*$`;
    }
    // If the pattern contains a slash, it is treated as part of the path
    else if (pattern.includes("/")) {
      regexPattern = `(^|.*/)${regexPattern}(/.*)?$`;
    }
    // Otherwise, it is treated as a filename or directory name
    else {
      regexPattern = `(^|.*/)(${regexPattern})(/.*)?$`;
    }

    try {
      regex = new RegExp(regexPattern);
      regexCache.set(pattern, regex);
    } catch (error) {
      console.error(`Invalid regex pattern: ${regexPattern}`, error);
      return false;
    }
  }

  return regex.test(path);
}

// Optimized version of matchesAnyIgnorePattern
function matchesAnyIgnorePatternOptimized(
  combinedPatterns: { pattern: string; isNegative: boolean }[],
  normalizedRelativePath: string,
  isDirectory = false,
): boolean {
  // Create a path for directories (add a trailing slash)
  const pathToCheck =
    isDirectory && !normalizedRelativePath.endsWith("/")
      ? `${normalizedRelativePath}/`
      : normalizedRelativePath;

  let isIgnored = false;
  let hasNegativeMatch = false;

  // Process negative patterns first
  for (const { pattern, isNegative } of combinedPatterns) {
    if (isNegative && matchGitignorePatternCached(pattern, pathToCheck)) {
      hasNegativeMatch = true;
      break; // Early return if matched a negative pattern
    }
  }

  // If matched a negative pattern, don't ignore
  if (hasNegativeMatch) {
    return false;
  }

  // Process positive patterns
  for (const { pattern, isNegative } of combinedPatterns) {
    if (!isNegative && matchGitignorePatternCached(pattern, pathToCheck)) {
      isIgnored = true;
      break; // Early return if matched a positive pattern
    }
  }

  return isIgnored;
}

// Export for testing
export const matchesAnyIgnorePattern = matchesAnyIgnorePatternOptimized;

export function listFiles(cwd: string, limit: number): ListFilesResult {
  const result: string[] = [];
  const combinedPatterns = composeIgnorePatterns(cwd, defaultIgnorePatterns);

  // Cache for normalized directory paths
  const normalizedPathCache = new Map<string, string>();

  function getNormalizedPath(path: string): string {
    if (normalizedPathCache.has(path)) {
      return normalizedPathCache.get(path) ?? "";
    }

    const relativePath = relative(cwd, path);
    if (!relativePath) return "";

    // Normalize path (convert Windows backslashes to forward slashes)
    const normalizedPath = relativePath.replace(/\\/g, "/");
    normalizedPathCache.set(path, normalizedPath);
    return normalizedPath;
  }

  function shouldIgnore(path: string, isDirectory = false): boolean {
    const normalizedPath = getNormalizedPath(path);
    if (!normalizedPath) return false;

    return matchesAnyIgnorePatternOptimized(
      combinedPatterns,
      normalizedPath,
      isDirectory,
    );
  }

  function traverseDirectory(currentPath: string): boolean {
    if (result.length >= limit) return true;

    try {
      // Check if the directory should be ignored first
      if (shouldIgnore(currentPath, true)) {
        // Don't completely skip, as there might be files specified by negative patterns
        // However, early return for directories that should clearly be ignored
        const normalizedPath = getNormalizedPath(currentPath);
        let hasNegativePattern = false;

        // Check if there are any negative patterns related to this directory
        for (const { isNegative, pattern } of combinedPatterns) {
          if (isNegative) {
            // If there's a negative pattern that might be related to this directory
            if (
              pattern.includes("/") &&
              normalizedPath.includes(pattern.split("/")[0])
            ) {
              hasNegativePattern = true;
              break;
            }
          }
        }

        // If there are no negative patterns, completely skip this directory
        if (!hasNegativePattern) {
          return false;
        }
      }

      const entries = readdirSync(currentPath);
      // Sort only if necessary (if tests depend on order)
      const sortedEntries = entries.sort();

      for (const entry of sortedEntries) {
        if (result.length >= limit) break;

        const fullPath = join(currentPath, entry);
        try {
          const stats = statSync(fullPath);

          if (stats.isDirectory()) {
            // For directories, process recursively
            traverseDirectory(fullPath);
          } else if (stats.isFile()) {
            // For files, check if they match ignore patterns
            if (!shouldIgnore(fullPath)) {
              result.push(fullPath);
            }
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes("ENOENT")) {
            // ignore error
          } else {
            console.error(`Error accessing ${fullPath}:`, error);
          }
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
