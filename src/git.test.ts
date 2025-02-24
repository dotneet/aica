import { describe, expect, it } from "bun:test";
import { afterEach, beforeEach } from "bun:test";
import { execSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { GitRepository } from "./git";

describe("GitRepository", () => {
  const testDir = join(process.cwd(), "test-repo");
  let gitRepo: GitRepository;

  beforeEach(async () => {
    // テスト用のGitリポジトリを作成
    await mkdir(testDir, { recursive: true });
    execSync("git init", { cwd: testDir });
    execSync('git config user.email "test@example.com"', { cwd: testDir });
    execSync('git config user.name "Test User"', { cwd: testDir });
    gitRepo = new GitRepository(testDir);
  });

  afterEach(async () => {
    // テスト用のディレクトリを削除
    await rm(testDir, { recursive: true, force: true });
  });

  it("should detect no changes in empty repository", async () => {
    const result = await gitRepo.getAllChangedFiles();
    expect(result.hasChanges).toBe(false);
    expect(result.stagedFiles).toEqual([]);
    expect(result.unstagedFiles).toEqual([]);
    expect(result.untrackedFiles).toEqual([]);
  });

  it("should detect untracked files", async () => {
    await writeFile(join(testDir, "untracked.txt"), "test");
    const result = await gitRepo.getAllChangedFiles();
    expect(result.hasChanges).toBe(true);
    expect(result.untrackedFiles).toEqual(["untracked.txt"]);
    expect(result.stagedFiles).toEqual([]);
    expect(result.unstagedFiles).toEqual([]);
  });

  it("should detect staged files", async () => {
    await writeFile(join(testDir, "staged.txt"), "test");
    execSync("git add staged.txt", { cwd: testDir });
    const result = await gitRepo.getAllChangedFiles();
    expect(result.hasChanges).toBe(true);
    expect(result.stagedFiles).toEqual(["staged.txt"]);
    expect(result.unstagedFiles).toEqual([]);
    expect(result.untrackedFiles).toEqual([]);
  });

  it("should detect unstaged changes in tracked files", async () => {
    // ファイルを作成してコミット
    await writeFile(join(testDir, "modified.txt"), "initial");
    execSync("git add modified.txt", { cwd: testDir });
    execSync('git commit -m "Initial commit"', { cwd: testDir });

    // ファイルを変更
    await writeFile(join(testDir, "modified.txt"), "modified");
    const result = await gitRepo.getAllChangedFiles();
    expect(result.hasChanges).toBe(true);
    expect(result.unstagedFiles).toEqual(["modified.txt"]);
    expect(result.stagedFiles).toEqual([]);
    expect(result.untrackedFiles).toEqual([]);
  });
});
