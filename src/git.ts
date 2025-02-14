export async function getGitDiffStageOnly(cwd: string) {
  const result = Bun.spawn({
    cmd: ["git", "diff"],
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
