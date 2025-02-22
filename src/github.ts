import { Issue } from "./analyze";
import { SummaryDiffItem } from "./summary";
import { Octokit as OctokitCore } from "@octokit/core";
import {
  restEndpointMethods,
  Api,
} from "@octokit/plugin-rest-endpoint-methods";

export const Octokit = OctokitCore.plugin(restEndpointMethods).defaults({});
export type Octokit = InstanceType<typeof Octokit> & Api;

export function createGitHubStyleTableFromSummaryDiffItems(
  summaryDiffItems: SummaryDiffItem[],
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
    private octokit: Octokit,
    public readonly owner: string,
    public readonly repo: string,
    public readonly number: number,
  ) {}

  static async create(
    octokit: Octokit,
    owner: string,
    repo: string,
    title: string,
    body: string,
    base: string,
    head: string,
    draft: boolean,
  ) {
    const response = await octokit.rest.pulls.create({
      owner,
      repo,
      title,
      body,
      base,
      head,
      draft,
    });
    return new PullRequest(octokit, owner, repo, response.data.number);
  }

  async getBody(): Promise<string> {
    const pullContent = await this.octokit.rest.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: this.number,
    });
    return pullContent.data.body ?? "";
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
      },
    );
  }

  getUrl(): string {
    return `https://github.com/${this.owner}/${this.repo}/pull/${this.number}`;
  }

  static async getDefaultBranch(
    octokit: Octokit,
    owner: string,
    repo: string,
  ): Promise<string> {
    const response = await octokit.rest.repos.get({
      owner,
      repo,
    });
    return response.data.default_branch;
  }
}

export async function getGitHubToken(): Promise<string> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    // try to get token from gh
    const result = Bun.spawn({
      cmd: ["gh", "auth", "token"],
    });
    await result.exited;
    if (result.exitCode !== 0) {
      throw new Error(
        "Failed to get GitHub token from environment variable or gh",
      );
    }
    const text = (await new Response(result.stdout).text()).trim();
    if (text) {
      return text;
    }
    throw new Error("Failed to get GitHub token");
  }
  return token;
}
