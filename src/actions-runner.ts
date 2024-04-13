import core from "@actions/core";
import github from "@actions/github";
import { readConfig } from "config";

try {
  const token = core.getInput("github-token", { required: true });
  const octokit = github.getOctokit(token);
  const model = Bun.env.OPENAI_MODEL || "gpt-4-turbo-2024-04-09";

  const config = readConfig(null);
  if (!config.llm.apiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }

  // TODO: Implement the action
} catch (error) {
  core.setFailed(error.message);
}
