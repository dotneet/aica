import path from "path";
import Bun from "bun";
import fs from "node:fs";
import { FileChange } from "@/utility/parse-diff";

export enum SourceType {
  Text,
  File,
  PullRequestDiff,
}

export class Source {
  constructor(
    readonly type: SourceType,
    readonly path: string,
    readonly content: string,
    readonly fileChange: FileChange | null = null,
  ) {}

  get targetSourceContent(): string {
    if (this.type === SourceType.PullRequestDiff) {
      return this.content;
    } else {
      return `file: ${this.path}\n\n` + this.contentWithLineNumbers;
    }
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

  static fromPullRequestDiff(change: FileChange): Source {
    return new Source(
      SourceType.PullRequestDiff,
      change.filename,
      change.changes.join("\n"),
      change,
    );
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
    let sources: Source[] = [];
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
    sources = sources.filter((source) => {
      const relativePath = path.relative(rootDir, source.path);
      return this.includePatternGlobs.some((include) =>
        include.match(relativePath),
      );
    });
    sources = sources.filter((source) => {
      const relativePath = path.relative(rootDir, source.path);
      return !this.excludePatternGlobs.some((exclude) =>
        exclude.match(relativePath),
      );
    });
    return sources;
  }
}
