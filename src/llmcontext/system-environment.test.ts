import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type ListFilesResult, listFiles } from "./system-environment";

describe("listFiles", () => {
  const testDir = join(import.meta.dir, "test-files");
  const files = [
    "file1.txt",
    "file2.txt",
    ".env",
    "node_modules/package.json",
    "src/test.ts",
    "src/deep/test.ts",
    "ignored-by-gitignore.txt",
    "temp/temp-file.txt",
    "doc/frotz/test.txt",
    "a/doc/frotz/test.txt",
    "build/hello.txt",
    "src/hello.txt",
    "src/hello.o",
    "src/hello.tmp",
    "src/temp/hello.txt",
    "debug/a/b/c/debug.log",
    "ignored-dir/file1.txt",
    "ignored-dir/subdir/file2.txt",
  ];

  beforeAll(async () => {
    // Setup: Create test directories and files
    await mkdir(testDir, { recursive: true });
    await mkdir(join(testDir, "src", "deep"), { recursive: true });
    await mkdir(join(testDir, "node_modules"), { recursive: true });
    await mkdir(join(testDir, "temp"), { recursive: true });
    await mkdir(join(testDir, "doc", "frotz"), { recursive: true });
    await mkdir(join(testDir, "a", "doc", "frotz"), { recursive: true });
    await mkdir(join(testDir, "build"), { recursive: true });
    await mkdir(join(testDir, "src", "temp"), { recursive: true });
    await mkdir(join(testDir, "debug", "a", "b", "c"), { recursive: true });
    await mkdir(join(testDir, "ignored-dir", "subdir"), { recursive: true });

    // Create .gitignore file
    await writeFile(
      join(testDir, ".gitignore"),
      `
# Comments are ignored
ignored-by-gitignore.txt
temp/
*.log

# Path prefix tests
/build/
doc/frotz/

# Wildcard tests
**/*.o
**/*.tmp

# Negative pattern tests
src/temp/
!src/temp/hello.txt

# Multiple * tests
debug/**/debug.log

# Directory ignore test
ignored-dir/
`,
    );

    // Create test files
    for (const file of files) {
      const filePath = join(testDir, file);
      await writeFile(filePath, "test content");
    }

    // Create log file that matches .gitignore pattern
    await writeFile(join(testDir, "test.log"), "log content");
  });

  afterAll(async () => {
    // Clean up: Delete test directory
    await rm(testDir, { recursive: true, force: true });
  });

  test("should list files with limit", () => {
    const result: ListFilesResult = listFiles(testDir, 2);
    expect(result.files).toHaveLength(2);
  });

  test("should ignore files in defaultIgnorePatterns", () => {
    const result: ListFilesResult = listFiles(testDir, 100);
    const files = result.files;

    // node_modules and .env files should be ignored
    const hasNodeModules = files.some((path) => path.includes("node_modules"));
    const hasEnvFile = files.some((path) => path.includes(".env"));
    expect(hasNodeModules).toBe(false);
    expect(hasEnvFile).toBe(false);

    // Regular files should be included
    const hasFile1 = files.some((path) => path.includes("file1.txt"));
    const hasFile2 = files.some((path) => path.includes("file2.txt"));
    expect(hasFile1).toBe(true);
    expect(hasFile2).toBe(true);
  });

  describe("gitignore patterns", () => {
    test("basic ignore patterns", () => {
      const result: ListFilesResult = listFiles(testDir, 100);
      const files = result.files;
      // Basic ignore patterns
      expect(files.some((p) => p.includes("ignored-by-gitignore.txt"))).toBe(
        false,
      );
      expect(files.some((p) => p.includes("temp/temp-file.txt"))).toBe(false);
      expect(files.some((p) => p.endsWith(".log"))).toBe(false);
    });

    test("prefix patterns", () => {
      const result: ListFilesResult = listFiles(testDir, 100);
      const files = result.files;
      // Path prefix
      expect(files.some((p) => p.includes("/build/"))).toBe(false);
      expect(files.some((p) => p.includes("doc/frotz/"))).toBe(false);
    });

    test("negative patterns", () => {
      const result: ListFilesResult = listFiles(testDir, 100);
      const files = result.files;
      // Negative patterns
      expect(files.some((p) => p.includes("src/temp/hello.txt"))).toBe(true);
      expect(files.some((p) => p.includes("src/hello.txt"))).toBe(true);
    });

    test("wildcard patterns", () => {
      const result: ListFilesResult = listFiles(testDir, 100);
      const files = result.files;
      // Wildcard patterns
      expect(files.some((p) => p.endsWith(".o"))).toBe(false);
      expect(files.some((p) => p.endsWith(".tmp"))).toBe(false);
    });

    test("** patterns", () => {
      const result: ListFilesResult = listFiles(testDir, 100);
      const files = result.files;
      // ** patterns
      expect(files.some((p) => p.includes("debug/a/b/c/debug.log"))).toBe(
        false,
      );
    });

    test("directory ignore patterns", () => {
      const result: ListFilesResult = listFiles(testDir, 100);
      const files = result.files;

      // ディレクトリ全体が無視されるパターン
      expect(files.some((p) => p.includes("ignored-dir/file1.txt"))).toBe(
        false,
      );
      expect(
        files.some((p) => p.includes("ignored-dir/subdir/file2.txt")),
      ).toBe(false);

      // 比較のため、無視されないファイルが含まれていることを確認
      expect(files.some((p) => p.includes("file1.txt"))).toBe(true);
    });
  });

  test("should return absolute paths", () => {
    const result: ListFilesResult = listFiles(testDir, 10);
    for (const path of result.files) {
      expect(path.startsWith("/")).toBe(true);
    }
  });
});
