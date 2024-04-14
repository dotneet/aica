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
