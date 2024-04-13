# AI Code Analyzer

## Motivation

There are already excellent code review tools like [pr-agent](https://github.com/Codium-ai/pr-agent) and [cursor](https://github.com/getcursor/cursor). However, pr-agent is based on GitHub, which limits its use, and cursor is not open source, so it cannot be fully customized or integrated into other tools.

So, I decided to create a tool with the following features.

- Fully customizable
- Open source
- Embeddable

## Usage

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run src/main.ts <glob-pattern>
```
