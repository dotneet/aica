import core from "@actions/core";
import github from "@actions/github";

try {
  const time = new Date().toTimeString();
  core.setOutput("time", time);
  github.context.eventName;
  const token = core.getInput("github-token", { required: true });
  const octokit = github.getOctokit(token);
  octokit.rest.issues.createComment({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: github.context.issue.number,
    body: "test",
  });
  // Get the JSON webhook payload for the event that triggered the workflow
  const payload = JSON.stringify(github.context.payload, undefined, 2);
  console.log(`The event payload: ${payload}`);
} catch (error) {
  core.setFailed(error.message);
}
