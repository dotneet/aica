import fs from "node:fs";
import path from "node:path";
import type { FileChange } from "@/utility/parse-diff";
import Bun from "bun";

export enum SourceType {
  Text = 0,
  File = 1,
  PullRequestDiff = 2,
}

export class Source {
  constructor(
    readonly type: SourceType,
    readonly path: string,
    readonly content: string,
    readonly fileChange: FileChange | null = null,
  ) {}

  get targetSourceContent(): string {
    return `file: ${this.path}\n\n${this.contentWithLineNumbers}`;
  }

  get diff(): string | null {
    return this.fileChange?.diff ?? null;
  }

  get contentWithLineNumbers(): string {
    return this.appendLineNumbers(this.content);
  }

  static fromText(filePath: string, content: string): Source {
    return new Source(SourceType.Text, filePath, content, null);
  }

  static fromFile(filePath: string): Source {
    const content = fs.readFileSync(filePath, "utf8");
    return new Source(SourceType.File, filePath, content, null);
  }

  static fromPullRequestDiff(
    repositoryDir: string,
    change: FileChange,
  ): Source {
    const filePath = path.join(repositoryDir, change.filename);
    const content = fs.readFileSync(filePath, "utf8");
    return new Source(SourceType.PullRequestDiff, filePath, content, change);
  }

  private appendLineNumbers(code: string): string {
    return code
      ? code
          .split("\n")
          .map((line, index) => `${index + 1}: ${line}`)
          .join("\n")
          .trim()
      : "";
  }
}

export class SourceFinder {
  private includePatternGlobs: Bun.Glob[];
  private excludePatternGlobs: Bun.Glob[];

  constructor(includePatterns: string[], excludePatterns: string[]) {
    this.includePatternGlobs = includePatterns.map(
      (pattern) => new Bun.Glob(pattern),
    );
    this.excludePatternGlobs = excludePatterns.map(
      (pattern) => new Bun.Glob(pattern),
    );
  }

  async getSources(directory: string, globPattern: string): Promise<Source[]> {
    const glob = new Bun.Glob(globPattern);
    const sources: Source[] = [];
    for await (const file of glob.scan(directory)) {
      const absPath = fs.realpathSync(file);
      sources.push(Source.fromFile(absPath));
    }
    return this.applyFilters(directory, sources);
  }

  async getModifiedFilesFromRepository(
    repositoryDir: string,
  ): Promise<Source[]> {
    const result = await Bun.spawn({
      cmd: ["git", "ls-files", "-m", "--full-name"],
      cwd: repositoryDir,
      stdout: "pipe",
    });

    const text = await new Response(result.stdout).text();
    const allFiles = text
      .trim()
      .split("\n")
      .filter((filename) => filename !== "");
    const uniqueFiles = [...new Set(allFiles)];
    const existsFiles = uniqueFiles.filter((file) => fs.existsSync(file));
    const sources = existsFiles
      .map((file) => path.join(repositoryDir, file))
      .map((file) => Source.fromFile(file));

    return this.applyFilters(repositoryDir, sources);
  }

  applyFilters(rootDir: string, sources: Source[]): Source[] {
    let filteredSources = sources.filter((source) => {
      const relativePath = path.relative(rootDir, source.path);
      return this.includePatternGlobs.some((include) =>
        include.match(relativePath),
      );
    });
    filteredSources = filteredSources.filter((source) => {
      const relativePath = path.relative(rootDir, source.path);
      return !this.excludePatternGlobs.some((exclude) =>
        exclude.match(relativePath),
      );
    });
    return sources;
  }
}
