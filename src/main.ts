import { parseArgs } from "node:util";
import {
  commitMessageCommandSchema,
  executeCommitMessageCommand,
} from "@/commands/commit-message-command";
import {
  executeReviewCommand,
  reviewCommandSchema,
} from "@/commands/review-command";
import pkg from "../package.json";
import {
  executeSummaryDiffCommand,
  summaryDiffCommandSchema,
} from "@/commands/summary-diff-command";
import {
  createPrCommandSchema,
  executeCreatePrCommand,
} from "./commands/create-pr-command";
import {
  commitCommandSchema,
  executeCommitCommand,
} from "./commands/commit-command";
import { CommandError } from "./commands/error";
import {
  executeShowConfigCommand,
  showConfigValuesSchema,
} from "./commands/show-config";
import {
  executeIndexCommand as executeReindexCommand,
  indexCommandSchema,
} from "./commands/index-command";

type SubCommand =
  | "version"
  | "help"
  | "review"
  | "commit-message"
  | "summary"
  | "commit"
  | "create-pr"
  | "reindex"
  | "show-config"
  | "index";

type CommandDefinition = {
  description: string;
  options: Record<
    string,
    {
      type: "string" | "boolean";
      description: string;
      default?: boolean | string;
    }
  >;
  args?: { name: string; description: string }[];
};

const commands: Record<SubCommand, CommandDefinition> = {
  review: {
    description: "Review code",
    options: {
      dir: { type: "string", description: "Target directory path" },
      slack: { type: "boolean", description: "Send notification to Slack" },
    },
    args: [{ name: "pattern", description: "Search pattern" }],
  },
  "commit-message": {
    description: "Generate commit message based on diff from HEAD",
    options: {
      dir: { type: "string", description: "Target directory path" },
    },
  },
  summary: {
    description: "Summarize diff from HEAD",
    options: {
      dir: { type: "string", description: "Target directory path" },
    },
  },
  commit: {
    description: "Create a commit with auto-generated message",
    options: {
      staged: {
        type: "boolean",
        description: "Only include staged changes",
      },
      dryRun: {
        type: "boolean",
        description: "Show result without execution",
      },
    },
  },
  "create-pr": {
    description: "Create a pull request",
    options: {
      withSummary: {
        type: "boolean",
        description: "Generate summary of diff from HEAD",
        default: true,
      },
      body: {
        type: "string",
        description: "Pull request body",
        default: "",
      },
      draft: {
        type: "boolean",
        description: "Create a draft pull request",
        default: false,
      },
      title: {
        type: "string",
        description: "Pull request title",
        default: "",
      },
      branchName: {
        type: "string",
        description: "Branch name",
        default: "",
      },
      dryRun: {
        type: "boolean",
        description: "Show result without execution",
      },
      staged: {
        type: "boolean",
        description: "Only include staged changes",
      },
    },
  },
  reindex: {
    description: "Create index for code and documentation",
    options: {},
  },
  "show-config": {
    description: "Show configuration",
    options: {
      default: { type: "boolean", description: "Show default configuration" },
    },
  },
  index: {
    description: "Create index for code and documentation",
    options: {},
  },
  version: {
    description: "Show version",
    options: {},
  },
  help: {
    description: "Show help",
    options: {},
  },
};

async function main() {
  const subCommand = Bun.argv[2] as SubCommand;
  if (!subCommand) {
    showHelp();
    return;
  }
  const commandDef = commands[subCommand];
  if (!commandDef) {
    console.error(`Unknown command: ${subCommand}`);
    process.exit(1);
  }
  const args = Bun.argv.slice(3);
  const options = commandDef.options;
  let parseResult = null;
  try {
    parseResult = parseArgs({
      args,
      options,
      allowPositionals: true,
    });
  } catch (e) {
    showHelp(subCommand);
    return;
  }
  const { values, positionals } = parseResult;

  if (values.version) {
    console.log(pkg.version);
    return;
  }

  if (values.help) {
    showHelp(subCommand);
    return;
  }

  try {
    switch (subCommand as SubCommand) {
      case "version":
        console.log(pkg.version);
        return;
      case "help":
        showHelp();
        return;
      case "review":
        const reviewValues = reviewCommandSchema.parse({
          ...values,
          pattern: positionals[0],
        });
        await executeReviewCommand(reviewValues);
        break;
      case "commit-message":
        const commitMessageValues = commitMessageCommandSchema.parse(values);
        await executeCommitMessageCommand(commitMessageValues);
        break;
      case "summary":
        const summaryValues = summaryDiffCommandSchema.parse(values);
        await executeSummaryDiffCommand(summaryValues);
        break;
      case "commit":
        const commitValues = commitCommandSchema.parse(values);
        await executeCommitCommand(commitValues);
        break;
      case "create-pr":
        const createPRValues = createPrCommandSchema.parse(values);
        await executeCreatePrCommand(createPRValues);
        break;
      case "reindex":
        const reindexValues = indexCommandSchema.parse(values);
        await executeReindexCommand(reindexValues);
        break;
      case "show-config": {
        const showConfigValues = showConfigValuesSchema.parse(values);
        await executeShowConfigCommand(showConfigValues);
        break;
      }
      case "index":
        await executeReindexCommand(values);
        break;
      default:
        console.error("Unknown subcommand:", subCommand);
        process.exit(1);
    }
  } catch (error) {
    if (error instanceof CommandError) {
      console.error(error.message);
      process.exit(1);
    } else {
      throw error;
    }
  }
}

function showHelp(command?: SubCommand) {
  if (command && command in commands) {
    const cmd = commands[command];
    console.log(`
Usage: aica ${command} ${
      cmd.args?.map((arg) => `[${arg.name}]`).join(" ") || ""
    } [options]

${cmd.description}

Options:
${Object.entries(cmd.options)
  .map(
    ([key, opt]) =>
      `  --${key.padEnd(15)} ${opt.description}${
        opt.default !== undefined ? ` (default: ${opt.default})` : ""
      }`,
  )
  .join("\n")}
${
  cmd.args
    ? `\nArguments:\n${cmd.args
        .map((arg) => `  ${arg.name.padEnd(15)} ${arg.description}`)
        .join("\n")}`
    : ""
}
    `);
    return;
  }

  console.log(`
Usage: aica <command> [options]

Commands:
${Object.entries(commands)
  .map(([key, cmd]) => `  ${key.padEnd(15)} ${cmd.description}`)
  .join("\n")}
`);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
