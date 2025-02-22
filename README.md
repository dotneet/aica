# aica - AI Code Analyzer

## Motivation

There are already excellent code review tools such as [pr-agent](https://github.com/Codium-ai/pr-agent) and [cursor](https://github.com/getcursor/cursor). However, pr-agent relies on code hosting services like GitHub, which limits its usability, and cursor is not open source, meaning it cannot be fully customized or integrated with other tools.

So, I decided to create a new tool with the following characteristics:

- Customizable
- Open Source
- Platform Independent

## Features

- [x] AI Coding Agent
- [x] AI Code Review
- [x] Automatic knowledge retrieving for code review
- [x] Symbol based code search for retrieving knowledge
- [x] Vector based document search for retrieving knowledge
- [x] Generate summary of changes
- [x] Generate commit message
- [x] Create pull request with AI-generated title and body
- [x] Prompt customization
- [x] Slack notification
- [x] Single binary executable by `bun build --compile`
- [x] GitHub Actions integration. (See [wiki page](https://github.com/dotneet/aica/wiki/GitHub-Actions-Settings) to setup actions.)

## Install

Build and install a binary:

```bash
# Install bun before build aica.
#
# Official Install Document:
# https://bun.sh/docs/installation#installing

git clone https://github.com/dotneet/aica.git
cd aica

bun install
bun run build
cp ./dist/aica path-to-your-bin-directory
```

Setup environment variables:

```bash
# You can set the following items in your environment variables or aica.toml file.
# must be set at least one of the following providers.

# OpenAI
export AICA_LLM_PROVIDER=openai
export OPENAI_API_KEY=your_api_key
export OPENAI_MODEL=o3-mini

# Anthropic
export AICA_LLM_PROVIDER=anthropic
export ANTHROPIC_API_KEY=your_api_key
export ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Gemini
export AICA_LLM_PROVIDER=google
export GOOGLE_API_KEY=your_api_key
export GOOGLE_MODEL=gemini-2.0-flash
```

## Configuration

You can customize the configuration by creating a `aica.toml` file.

See [aica.example.toml](aica.example.toml).

aica.toml must be placed in one of the following directories.

- root directory of the repository
- ${HOME}/.config/aica/aica.toml
- ${GITHUB_WORKSPACE}/aica.toml

## Usage

### Review

```bash
# review the diff from HEAD
aica review [options] [pattern]

# review specific files
aica review src/main.ts

# review the files matching the specific glob pattern
aica review "src/**/*.ts"
```

Options:

- `--dir`: Target directory path
- `--slack`: Send notification to Slack

### Agent

```bash
# execute AI agent with a prompt
aica agent "your prompt here"

# execute AI agent with a instruction file
aica agent -f instruction.txt
```

This command executes a task using an AI agent. The agent automatically determines and executes the necessary actions based on the given prompt.

Recommend to use anthropic claude 3.5 sonnet for agent.

NOTE: This command has potential to break your file system. Please be careful.

### Reindex

```bash
# reindex the code and document databases
aica reindex
```

### Summary

```bash
# generate a summary of the diff from HEAD
aica summary [options]
```

Options:

- `--dir`: Target directory path

### Commit Changes

This command commits changes with an AI-generated commit message.

```bash
# commit all changes(including untracked and unstaged changes) with an AI-generated commit message
aica commit [options]

# commit only staged changes with an AI-generated commit message
aica commit --staged

# commit all changes and push to remote repository
aica commit --push
```

Options:

- `--staged`: commit only staged changes.
- `--dryRun`: Show result without execution
- `--push`: Push to remote repository after committing

### Create Pull Request

This command creates a pull request on GitHub.

```bash
# create a pull request
# if there are changes, it will commit them and create a pull request.
aica create-pr [options]

# commit only staged changes and create a pull request
aica create-pr --staged
```

Options:

- `--withSummary`: Generate summary of diff from HEAD (default: true)
- `--body`: Pull request body
- `--dryRun`: Show result without execution
- `--staged`: Only include staged changes

### Generate Commit Message

```bash
# generate a one-line commit message based on the diff from HEAD
aica commit-message [options]
```

Options:

- `--dir`: Target directory path

### Show Configuration

```bash
# show current configuration
aica show-config [options]
```

Options:

- `--default`: Show default configuration

### Other Commands

- `aica --version`: Show version information
- `aica --help [command]`: Show help information for a specific command or general help

## GitHub Actions Settings

See [wiki page](https://github.com/dotneet/aica/wiki/GitHub-Actions-Settings) for details.
