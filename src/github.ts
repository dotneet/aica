import { GitHub } from "@actions/github/lib/utils";
import { Issue } from "./analyze";
import { SummaryDiffItem } from "./summary";

export function createGitHubStyleTableFromSummaryDiffItems(
  summaryDiffItems: SummaryDiffItem[]
): string {
  const header = "| Category | Description |";
  const table = summaryDiffItems.map((item) => {
    return `| ${item.category} | ${item.description} |`;
  });
  return header + "\n" + "|---|---|" + "\n" + table.join("\n");
}

export function createGitHubStyleTableFromIssues(issues: Issue[]): string {
  const header = "| File | Description |";
  const table = issues.map((issue) => {
    return `| ${issue.file} | ${issue.description} |`;
  });
  return header + "\n" + "|---|---|" + "\n" + table.join("\n");
}

export class PullRequest {
  constructor(
    private octokit: InstanceType<typeof GitHub>,
    private owner: string,
    private repo: string,
    private number: number
  ) {}

  async getBody(): Promise<string> {
    const pullContent = await this.octokit.rest.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: this.number,
    });
    return pullContent.data.body;
  }

  async getDiff(pullNumber: number): Promise<string> {
    const endpoint = `GET /repos/{owner}/{repo}/pulls/{pull_number}`;
    const response = await this.octokit.request(endpoint, {
      owner: this.owner,
      repo: this.repo,
      pull_number: pullNumber,
      mediaType: {
        format: "diff",
      },
    });
    return response.data as unknown as string;
  }

  async updateBody(body: string): Promise<void> {
    await this.octokit.rest.pulls.update({
      owner: this.owner,
      repo: this.repo,
      pull_number: this.number,
      body,
    });
  }

  async postComment(comment: string): Promise<void> {
    await this.octokit.request(
      "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
      {
        owner: this.owner,
        repo: this.repo,
        issue_number: this.number,
        body: comment,
      }
    );
  }
}
