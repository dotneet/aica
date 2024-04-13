# AI Code Analyzer

## Motivation

There are already excellent code review tools like [pr-agent](https://github.com/Codium-ai/pr-agent) and [cursor](https://github.com/getcursor/cursor). However, pr-agent is based on GitHub, which limits its use, and cursor is not open source, so it cannot be fully customized or integrated into other tools.

So, I decided to create a new tool with the following characteristics.

- Customizable
- Open Source
- Platform Independent

## Features

- [x] AI Code Review
- [x] Automatic knowledge retrieving
- [x] Symbol based code search for retrieving knowledge
- [x] Vector based document search for retrieving knowledge
- [x] Prompt customization
- [x] Slack notification
- [x] Single binary executable by `bun build --compile`

## Usage

To install dependencies:

```bash
bun install
```

To run:

```bash
export OPENAI_API_KEY=your_api_key
export OPENAI_MODEL=gpt-4-turbo-2024-04-09 # optional

bun run src/main.ts <glob-pattern>
```

To create single binary executable:

```bash
bun run build
```
