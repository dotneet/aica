import fs from "node:fs";
import path from "node:path";
import type { RulesConfig } from "../config";

export type MDCContent = {
  description: string;
  globs: string;
  content: string;
};

export type RulesFindResult = {
  fixedContexts: string[];
  fileRules: MDCContent[];
};

/**
 * RulesFinder is responsible for finding and parsing MDC (Markdown Configuration) files
 * in a specified directory structure. It handles both fixed rules (specified in config)
 * and dynamic rules (found in .cursor/rules directory).
 *
 * Usage:
 *
 * ```typescript
 * const rulesFinder = new RulesFinder(baseDir, config);
 * const files = ["./src/foo.ts", "./src/bar.ts"];
 * const rules = await rulesFinder.findAllRules(files);
 * ```
 *
 * MDC File Format:
 * ```
 * ---
 * description: Rule description
 * globs: File pattern (e.g., *.ts, *.{js,jsx})
 * ---
 * Rule content in markdown format
 * ```
 */
export class RulesFinder {
  private baseDir: string;
  private config: RulesConfig;

  constructor(baseDir: string, config: RulesConfig) {
    this.baseDir = baseDir;
    this.config = config;
  }

  /**
   * Reads and parses an MDC file.
   * @param filePath - Path to the MDC file
   * @returns Parsed MDC content or null if the file is invalid or cannot be read
   */
  private async readMDCFile(filePath: string): Promise<MDCContent | null> {
    try {
      const content = await fs.promises.readFile(filePath, "utf-8");
      const parts = content.split("---\n");
      if (parts.length < 3) return null;

      const headerLines = parts[1].trim().split("\n");
      const description =
        headerLines
          .find((line) => line.startsWith("description:"))
          ?.split("description:")[1]
          ?.trim() || "";
      const globs =
        headerLines
          .find((line) => line.startsWith("globs:"))
          ?.split("globs:")[1]
          ?.trim() || "";

      return {
        description,
        globs,
        content: parts[2].trim(),
      };
    } catch (error) {
      console.error(`Error reading MDC file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Checks if any of the provided file paths match the given glob pattern.
   * Supports comma-separated patterns and basic glob syntax (e.g., *.ts).
   *
   * @param filePaths - List of file paths to check
   * @param globPattern - Comma-separated glob patterns
   * @returns True if any file matches any of the patterns
   */
  private async matchesGlobPattern(
    filePaths: string[],
    globPattern: string,
  ): Promise<boolean> {
    try {
      const patterns = globPattern.split(",").map((p) => p.trim());
      const normalizedFilePaths = filePaths.map((file) =>
        path.relative(this.baseDir, path.resolve(this.baseDir, file)),
      );

      return normalizedFilePaths.some((file) =>
        patterns.some((pattern) => {
          const cleanPattern = pattern.replace(/^\*\./, ".");
          return file.endsWith(cleanPattern);
        }),
      );
    } catch (error) {
      console.error(`Error matching glob pattern ${globPattern}:`, error);
      return false;
    }
  }

  /**
   * Finds and parses fixed rules specified in the configuration.
   * @returns Array of parsed MDC contents
   */
  async findFixedContext(): Promise<string[]> {
    const rules: string[] = [];
    for (const filePath of this.config.files) {
      const fullPath = path.resolve(this.baseDir, filePath);
      try {
        const file = Bun.file(fullPath);
        if (await file.exists()) {
          const content = await file.text();
          if (content) {
            rules.push(content);
          }
        }
      } catch (error) {
        console.error(`Error reading fixed rule file ${fullPath}:`, error);
      }
    }
    return rules;
  }

  /**
   * Finds and parses rules from .cursor/rules directory that match the provided file paths.
   * @param filePaths - List of file paths to match against rule glob patterns
   * @returns Array of matching MDC contents
   */
  async findRulesForFiles(filePaths: string[]): Promise<MDCContent[]> {
    if (!this.config.findCursorRules || filePaths.length === 0) return [];

    const rulesDir = path.join(this.baseDir, ".cursor/rules");
    if (!fs.existsSync(rulesDir)) return [];

    const rules: MDCContent[] = [];
    try {
      const mdcFiles = await fs.promises.readdir(rulesDir);

      for (const mdcFile of mdcFiles) {
        if (!mdcFile.endsWith(".mdc")) continue;

        const fullPath = path.join(rulesDir, mdcFile);
        const content = await this.readMDCFile(fullPath);
        if (content?.globs) {
          const matches = await this.matchesGlobPattern(
            filePaths,
            content.globs,
          );
          if (matches) {
            rules.push(content);
          }
        }
      }
    } catch (error) {
      console.error(`Error reading rules directory ${rulesDir}:`, error);
    }

    return rules;
  }

  /**
   * Finds all applicable rules by combining fixed rules and file-specific rules.
   * @param filePaths - List of file paths to match against rule glob patterns
   * @returns Object containing both fixed rules and file-specific rules
   */
  async findAllRules(filePaths: string[] = []): Promise<RulesFindResult> {
    const [fixedContexts, fileRules] = await Promise.all([
      this.findFixedContext(),
      this.findRulesForFiles(filePaths),
    ]);

    return {
      fixedContexts,
      fileRules,
    };
  }

  static buildPrompt(rules: RulesFindResult): string {
    return `
=== ADDITIONAL CONTEXT ===
${rules.fixedContexts.join("\n===\n")}
===
${rules.fileRules
  .map((rule) => `${rule.description}\n\n${rule.content}`)
  .join("\n===\n")}
=== END OF ADDITIONAL CONTEXT ===
`;
  }
}
