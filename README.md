# aica - AI Code Analyzer

## Motivation

There are already excellent code review tools such as [pr-agent](https://github.com/Codium-ai/pr-agent) and [cursor](https://github.com/getcursor/cursor). However, pr-agent relies on code hosting services like GitHub, which limits its usability, and cursor is not open source, meaning it cannot be fully customized or integrated with other tools.

So, I decided to create a new tool with the following characteristics:

- Customizable
- Open Source
- Platform Independent

## Features

- [x] AI Code Review
- [x] Automatic knowledge retrieving
- [x] Symbol based code search for retrieving knowledge
- [x] Vector based document search for retrieving knowledge
- [x] Generate summary of changes
- [x] Generate commit message
- [x] Prompt customization
- [x] Slack notification
- [x] Single binary executable by `bun build --compile`
- [x] GitHub Actions integration. (See [wiki page](https://github.com/dotneet/aica/wiki/GitHub-Actions-Settings) to setup actions.)

## Setup

Build and install a binary:

```bash
# if you don't have bun installed, install it first.
# With macOS:
# brew install bun

bun install
bun run build
cp ./dist/aica path-to-your-bin-directory
```

Setup environment variables:

```bash
export OPENAI_API_KEY=your_api_key
export OPENAI_MODEL=gpt-4-turbo-2024-04-09 # optional
```

## Usage

### Review

```bash
# review the diff from HEAD
aica review

# review specific files
aica review src/main.ts

# review the files matching the specific glob pattern
aica review "src/**/*.ts"
```

### Summary Changes

```bash
# summarize the diff from HEAD
aica summary-diff
```

### Generate Commit Message

```bash
# generate a one-line commit message based on the diff from HEAD
aica commit-message
```
