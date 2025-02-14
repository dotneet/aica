export async function getGitDiff(cwd: string) {
  const result = Bun.spawn({
    cmd: ["git", "diff", "HEAD"],
    cwd,
    stdout: "pipe",
  });
  await result.exited;
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
  });
  const code = await revParseResult.exited;
  if (code !== 0) {
    return null;
  }
  const text = (await new Response(revParseResult.stdout).text()).trim();
  return text;
}

export async function getCurrentBranch(cwd: string): Promise<string> {
  const result = Bun.spawn({
    cmd: ["git", "branch", "--show-current"],
    cwd,
    stdout: "pipe",
  });
  await result.exited;
  const text = (await new Response(result.stdout).text()).trim();
  return text;
}

export async function getOriginOwnerAndRepo(cwd: string): Promise<{
  owner: string;
  repo: string;
}> {
  const result = Bun.spawn({
    cmd: ["git", "remote", "get-url", "origin"],
    cwd,
    stdout: "pipe",
  });
  await result.exited;
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
  });
  await result.exited;
  return result.exitCode === 0;
}
