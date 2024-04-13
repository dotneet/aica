import { Issue } from "analyze";

export function createGitHubStyleTableFromIssues(issues: Issue[]): string {
  const header = "| File | Description |";
  const table = issues.map((issue) => {
    return `| ${issue.file} | ${issue.description} |`;
  });
  return header + "\n" + "|---|---|" + "\n" + table.join("\n");
}
