export async function getGitDiffFromRemoteBranch(cwd: string, branch: string) {
  const result = Bun.spawn({
    cmd: ["git", "diff", "--staged", `origin/${branch}`],
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  await result.exited;
  if (result.exitCode !== 0) {
    const text = (await new Response(result.stderr).text()).trim();
    throw new Error(`Failed to get git diff from remote branch: ${text}`);
  }
  const text = (await new Response(result.stdout).text()).trim();
  return text;
}

export async function getBranchDiffLikePullRequest(
  cwd: string,
  baseBranch: string,
  targetBranch: string,
) {
  const mergeBase = await getMergeBase(cwd, baseBranch, targetBranch);
  const result = Bun.spawn({
    cmd: ["git", "diff", mergeBase],
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  await result.exited;
  if (result.exitCode !== 0) {
    const text = (await new Response(result.stderr).text()).trim();
    throw new Error(`Failed to get git diff like pull request: ${text}`);
  }
  const text = (await new Response(result.stdout).text()).trim();
  return text;
}

export async function getMergeBase(
  cwd: string,
  baseBranch: string,
  targetBranch: string,
) {
  const result = Bun.spawn({
    cmd: ["git", "merge-base", baseBranch, targetBranch],
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  await result.exited;
  if (result.exitCode !== 0) {
    const text = (await new Response(result.stderr).text()).trim();
    throw new Error(`Failed to get git merge base: ${text}`);
  }
  const text = (await new Response(result.stdout).text()).trim();
  return text;
}

export async function getGitDiffStageOnly(cwd: string) {
  const result = Bun.spawn({
    cmd: ["git", "diff", "--staged"],
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  await result.exited;
  if (result.exitCode !== 0) {
    const text = (await new Response(result.stderr).text()).trim();
    throw new Error(`Failed to get git diff stage only: ${text}`);
  }
  const text = (await new Response(result.stdout).text()).trim();
  return text;
}

export async function getGitDiffToHead(cwd: string) {
  const result = Bun.spawn({
    cmd: ["git", "diff", "HEAD"],
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  await result.exited;
  if (result.exitCode !== 0) {
    const text = (await new Response(result.stderr).text()).trim();
    throw new Error(`Failed to get git diff to head: ${text}`);
  }
  const text = (await new Response(result.stdout).text()).trim();
  return text;
}

export async function getGitRepositoryRoot(
  cwd: string,
): Promise<string | null> {
  const revParseResult = Bun.spawn({
    cmd: ["git", "rev-parse", "--show-toplevel"],
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  await revParseResult.exited;
  if (revParseResult.exitCode !== 0) {
    const text = (await new Response(revParseResult.stderr).text()).trim();
    throw new Error(`Failed to get git repository root: ${text}`);
  }
  const text = (await new Response(revParseResult.stdout).text()).trim();
  return text;
}

export async function getCurrentBranch(cwd: string): Promise<string> {
  const result = Bun.spawn({
    cmd: ["git", "branch", "--show-current"],
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  await result.exited;
  if (result.exitCode !== 0) {
    const text = (await new Response(result.stderr).text()).trim();
    throw new Error(`Failed to get current branch: ${text}`);
  }
  const text = (await new Response(result.stdout).text()).trim();
  return text;
}

export async function pushToRemote(cwd: string, branch: string) {
  const result = Bun.spawn({
    cmd: ["git", "push", "origin", branch],
    cwd,
    stdout: "ignore",
    stderr: "pipe",
  });
  await result.exited;
  if (result.exitCode !== 0) {
    const text = (await new Response(result.stderr).text()).trim();
    throw new Error(`Failed to push to remote: ${text}`);
  }
}

export async function getOriginOwnerAndRepo(cwd: string): Promise<{
  owner: string;
  repo: string;
}> {
  const result = Bun.spawn({
    cmd: ["git", "remote", "get-url", "origin"],
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  await result.exited;
  if (result.exitCode !== 0) {
    const text = (await new Response(result.stderr).text()).trim();
    throw new Error(`Failed to get origin owner and repo: ${text}`);
  }
  const text = (await new Response(result.stdout).text()).trim();
  const match = text.match(/^git@github\.com:(.*)\/(.*)\.git$/);
  if (!match) {
    throw new Error("Invalid remote URL");
  }
  return { owner: match[1], repo: match[2] };
}

export async function commit(cwd: string, message: string): Promise<boolean> {
  const result = Bun.spawn({
    cmd: ["git", "commit", "-m", message],
    cwd,
    stdout: "ignore",
    stderr: "pipe",
  });
  await result.exited;
  if (result.exitCode !== 0) {
    const text = (await new Response(result.stderr).text()).trim();
    throw new Error(`Failed to commit: ${text}`);
  }
  return true;
}

export async function fetchRemote(cwd: string) {
  const result = Bun.spawn({
    cmd: ["git", "fetch", "origin"],
    cwd,
    stdout: "ignore",
    stderr: "pipe",
  });
  await result.exited;
  if (result.exitCode !== 0) {
    const text = (await new Response(result.stderr).text()).trim();
    throw new Error(`Failed to fetch remote: ${text}`);
  }
}

export interface ChangedFiles {
  hasChanges: boolean;
  stagedFiles: string[];
  unstagedFiles: string[];
  untrackedFiles: string[];
}

export type ConfirmationRequiredFile = {
  file: string;
  message: string;
};

export type AddingFilesToStageResult = {
  addingFiles: string[];
  confirmationRequiredFiles: ConfirmationRequiredFile[];
};

function isSafeToAdd(file: string): boolean {
  // .env* must not be added to stage
  if (file.startsWith(".env")) {
    return false;
  }
  // bigger than 2MB
  if (Bun.file(file).size > 2 * 1024 * 1024) {
    return false;
  }
  return true;
}

export async function addFilesToStage(gitRoot: string, files: string[]) {
  const result = Bun.spawn(["git", "add", ...files], {
    cwd: gitRoot,
  });
  await result.exited;
  if (result.exitCode !== 0) {
    const text = (await new Response(result.stderr).text()).trim();
    throw new Error(`Failed to add files to stage: ${text}`);
  }
}

export async function getAddingFilesToStage(
  gitRoot: string,
): Promise<AddingFilesToStageResult> {
  const status = await getAllChangedFiles(gitRoot);
  if (!status.hasChanges) {
    return { addingFiles: [], confirmationRequiredFiles: [] };
  }
  const addingFiles: string[] = [];
  const confirmationRequiredFiles: ConfirmationRequiredFile[] = [];
  for (const file of status.unstagedFiles) {
    if (!isSafeToAdd(file)) {
      confirmationRequiredFiles.push({
        file,
        message: "This file is too large to add to stage",
      });
      continue;
    }
    addingFiles.push(file);
  }
  for (const file of status.untrackedFiles) {
    if (!isSafeToAdd(file)) {
      confirmationRequiredFiles.push({
        file,
        message: "This file is too large to add to stage",
      });
      continue;
    }
    addingFiles.push(file);
  }
  return { addingFiles, confirmationRequiredFiles };
}

export async function getAllChangedFiles(
  gitRoot: string,
): Promise<ChangedFiles> {
  // ステージされたファイルを取得
  const stagedProc = Bun.spawn(["git", "diff", "--staged", "--name-only"], {
    cwd: gitRoot,
    stdout: "pipe",
  });
  await stagedProc.exited;
  const stagedFiles = (await new Response(stagedProc.stdout).text())
    .trim()
    .split("\n")
    .filter(Boolean);

  // 未ステージのファイルを取得
  const unstagedProc = Bun.spawn(["git", "diff", "--name-only"], {
    cwd: gitRoot,
    stdout: "pipe",
  });
  await unstagedProc.exited;
  const unstagedFiles = (await new Response(unstagedProc.stdout).text())
    .trim()
    .split("\n")
    .filter(Boolean);

  // untrackedファイルを取得
  const untrackedProc = Bun.spawn(
    ["git", "ls-files", "--others", "--exclude-standard"],
    { cwd: gitRoot, stdout: "pipe" },
  );
  await untrackedProc.exited;
  const untrackedFiles = (await new Response(untrackedProc.stdout).text())
    .trim()
    .split("\n")
    .filter(Boolean);

  return {
    hasChanges:
      stagedFiles.length > 0 ||
      unstagedFiles.length > 0 ||
      untrackedFiles.length > 0,
    stagedFiles,
    unstagedFiles,
    untrackedFiles,
  };
}
