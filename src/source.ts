import path from "path";
import fs from "node:fs";

export class Source {
  constructor(readonly path: string, readonly content: string) {}

  get contentWithLineNumbers(): string {
    return this.appendLineNumbers(this.content);
  }

  static fromText(filePath: string, content: string): Source {
    return new Source(filePath, content);
  }

  static fromFile(filePath: string): Source {
    const content = fs.readFileSync(filePath, "utf8");
    return new Source(filePath, content);
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

import Bun from "bun";

export class SourceFinder {
  private excludePatternGlobs: Bun.Glob[];

  constructor(
    private readonly suffixPatterns: string[],
    private readonly excludePatterns: string[]
  ) {
    this.excludePatternGlobs = excludePatterns.map(
      (pattern) => new Bun.Glob(pattern)
    );
  }

  async getSources(directory: string, globPattern: string): Promise<Source[]> {
    const glob = new Bun.Glob(globPattern);
    let sources: Source[] = [];
    for await (const file of glob.scan(directory)) {
      const absPath = path.join(directory, file);
      sources.push(Source.fromFile(absPath));
    }
    return this.applyFilters(directory, sources);
  }

  async getModifiedFilesFromRepository(
    repositoryDir: string
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
    const sources = uniqueFiles
      .map((file) => path.join(repositoryDir, file))
      .map((file) => Source.fromFile(file));

    return this.applyFilters(repositoryDir, sources);
  }

  applyFilters(rootDir: string, sources: Source[]): Source[] {
    sources = sources.filter((source) => {
      const relativePath = path.relative(rootDir, source.path);
      return this.suffixPatterns.some((suffix) =>
        relativePath.endsWith(suffix)
      );
    });
    sources = sources.filter((source) => {
      const relativePath = path.relative(rootDir, source.path);
      return !this.excludePatternGlobs.some((exclude) =>
        exclude.match(relativePath)
      );
    });
    return sources;
  }
}
