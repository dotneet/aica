export type GitHubIssueComment = {
  author_association:
    | "COLLABORATOR"
    | "CONTRIBUTOR"
    | "FIRST_TIMER"
    | "FIRST_TIME_CONTRIBUTOR"
    | "MANNEQUIN"
    | "MEMBER"
    | "NONE"
    | "OWNER";
  body: string;
  commit_id: string;
  created_at: string;
  diff_hunk: string;
  html_url: string;
  id: number;
  in_reply_to_id?: number;
  line: number | null;
  original_commit_id: string;
  original_line: number | null;
  original_position: number;
  original_start_line: number | null;
  path: string;
  position: number | null;
  pull_request_review_id: number | null;
  pull_request_url: string;
  reactions: {
    [key: string]: unknown;
  };
  side: "LEFT" | "RIGHT";
  start_line: number | null;
  start_side: "LEFT" | "RIGHT" | null;
  subject_type?: "line" | "file";
  updated_at: string;
  url: string;
  user: {
    [key: string]: unknown;
  } | null;
};

export type GitHubRepository = {
  allow_forking: boolean;
  archive_url: string;
  archived: boolean;
  assignees_url: string;
  blobs_url: string;
  branches_url: string;
  clone_url: string;
  collaborators_url: string;
  comments_url: string;
  commits_url: string;
  compare_url: string;
  contents_url: string;
  contributors_url: string;
  created_at: string;
  default_branch: string;
  deployments_url: string;
  description: string | null;
  disabled: boolean;
  downloads_url: string;
  events_url: string;
  fork: boolean;
  forks: number;
  forks_count: number;
  forks_url: string;
  full_name: string;
  git_commits_url: string;
  git_refs_url: string;
  git_tags_url: string;
  git_url: string;
  has_discussions: boolean;
  has_downloads: boolean;
  has_issues: boolean;
  has_pages: boolean;
  has_projects: boolean;
  has_wiki: boolean;
  homepage: string | null;
  hooks_url: string;
  html_url: string;
  id: number;
  is_template: boolean;
  issue_comment_url: string;
  issue_events_url: string;
  issues_url: string;
  keys_url: string;
  labels_url: string;
  language: string | null;
  languages_url: string;
  license: GitHubLicense | null;
  merges_url: string;
  milestones_url: string;
  mirror_url: string | null;
  name: string;
  node_id: string;
  notifications_url: string;
  open_issues: number;
  open_issues_count: number;
  owner: GitHubUser;
  private: boolean;
  pulls_url: string;
  pushed_at: string;
  releases_url: string;
  size: number;
  ssh_url: string;
  stargazers_count: number;
  stargazers_url: string;
  statuses_url: string;
  subscribers_url: string;
  subscription_url: string;
  svn_url: string;
  tags_url: string;
  teams_url: string;
  topics: string[];
  trees_url: string;
  updated_at: string;
  url: string;
  visibility: "public" | "private";
  watchers: number;
  watchers_count: number;
  web_commit_signoff_required: boolean;
};

export type GitHubUser = {
  login: string;
  id: number;
  avatar_url: string;
  gravatar_id: string;
  url: string;
  html_url: string;
  followers_url: string;
  following_url: string;
  gists_url: string;
  starred_url: string;
  subscriptions_url: string;
  organizations_url: string;
  repos_url: string;
  events_url: string;
  received_events_url: string;
  type: string;
  site_admin: boolean;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  hireable: boolean | null;
  bio: string | null;
  twitter_username: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
};

export type GitHubLabel = {
  id: number;
  url: string;
  name: string;
  color: string;
  default: boolean;
  description: string | null;
};

export type GitHubTeam = {
  id: number;
  url: string;
  html_url: string;
  name: string;
  slug: string;
  description: string | null;
  privacy: string;
  permission: string;
  members_url: string;
  repositories_url: string;
};

export type GitHubMilestone = {
  url: string;
  html_url: string;
  labels_url: string;
  id: number;
  number: number;
  state: string;
  title: string;
  description: string | null;
  creator: GitHubUser | null;
  open_issues: number;
  closed_issues: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  due_on: string | null;
};

export type GitHubPullRequest = {
  _links: {
    self: { href: string };
    html: { href: string };
    issue: { href: string };
    comments: { href: string };
    review_comments: { href: string };
    review_comment: { href: string };
    commits: { href: string };
    statuses: { href: string };
  };
  active_lock_reason: "resolved" | "off-topic" | "too heated" | "spam" | null;
  additions: number;
  assignee: GitHubUser | null;
  assignees: GitHubUser[];
  author_association:
    | "COLLABORATOR"
    | "CONTRIBUTOR"
    | "FIRST_TIMER"
    | "FIRST_TIME_CONTRIBUTOR"
    | "MANNEQUIN"
    | "MEMBER"
    | "NONE"
    | "OWNER";
  auto_merge: {
    enabled_by: GitHubUser;
    merge_method: string;
    commit_title: string;
    commit_message: string;
  } | null;
  base: {
    ref: string;
    sha: string;
    repo: GitHubRepository;
    user: GitHubUser;
  };
  body: string | null;
  changed_files: number;
  closed_at: string | null;
  comments: number;
  comments_url: string;
  commits: number;
  commits_url: string;
  created_at: string;
  deletions: number;
  diff_url: string;
  draft: boolean;
  head: {
    ref: string;
    sha: string;
    repo: GitHubRepository;
    user: GitHubUser;
  };
  html_url: string;
  id: number;
  issue_url: string;
  labels: GitHubLabel[];
  locked: boolean;
  maintainer_can_modify: boolean;
  merge_commit_sha: string | null;
  mergeable: boolean | null;
  mergeable_state: string;
  merged: boolean;
  merged_at: string | null;
  merged_by: GitHubUser | null;
  milestone: GitHubMilestone | null;
  node_id: string;
  number: number;
  patch_url: string;
  rebaseable: boolean;
  requested_reviewers: GitHubUser[];
  requested_teams: GitHubTeam[];
  review_comment_url: string;
  review_comments: number;
  review_comments_url: string;
  state: "open" | "closed";
  statuses_url: string;
  title: string;
  updated_at: string;
  url: string;
  user:
    | (GitHubUser & {
        user_view_type?: string;
      })
    | null;
};

export type GitHubIssue = {
  active_lock_reason: "resolved" | "off-topic" | "too heated" | "spam" | null;
  assignee: GitHubUser | null;
  assignees: GitHubUser[];
  author_association:
    | "COLLABORATOR"
    | "CONTRIBUTOR"
    | "FIRST_TIMER"
    | "FIRST_TIME_CONTRIBUTOR"
    | "MANNEQUIN"
    | "MEMBER"
    | "NONE"
    | "OWNER";
  body: string | null;
  closed_at: string | null;
  comments: number;
  comments_url: string;
  created_at: string;
  draft: boolean;
  events_url: string;
  html_url: string;
  id: number;
  labels: GitHubLabel[];
  labels_url: string;
  locked: boolean;
  milestone: GitHubMilestone | null;
  node_id: string;
  number: number;
  performed_via_github_app: unknown | null;
  pull_request?: {
    diff_url: string;
    html_url: string;
    merged_at: string | null;
    patch_url: string;
    url: string;
  };
  reactions: {
    "+1": number;
    "-1": number;
    confused: number;
    eyes: number;
    heart: number;
    hooray: number;
    laugh: number;
    rocket: number;
    total_count: number;
    url: string;
  };
  repository_url: string;
  state: "open" | "closed";
  state_reason: string | null;
  sub_issues_summary?: {
    completed: number;
    percent_completed: number;
    total: number;
  };
  timeline_url: string;
  title: string;
  updated_at: string;
  url: string;
  user: GitHubUser | null;
};

export type GitHubLicense = {
  key: string;
  name: string;
  node_id: string;
  spdx_id: string;
  url: string;
};
