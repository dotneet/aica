import { Issue } from "analyze";

export function createGitHubStyleTableFromIssues(issues: Issue[]): string {
  const header = "| File | Line | Description |";
  const table = issues.map((issue) => {
    return `| ${issue.file} | ${issue.line} | ${issue.description} |`;
  });
  return header + "\n" + "|---|---|---|" + "\n" + table.join("\n");
}
