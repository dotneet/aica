import chalk from "chalk";

export interface AgentConsole {
  thinking(message: string): void;
  tool(message: string): void;
  assistant(message: string): void;
  user(message: string): void;
}

export class StdoutAgentConsole implements AgentConsole {
  thinking(message: string) {
    console.log(chalk.gray(`<thinking>\n${message}\n</thinking>`));
  }

  tool(message: string) {
    console.log(chalk.green(message));
  }

  assistant(message: string) {
    console.log(chalk.blue(message));
  }

  user(message: string) {
    console.log(message);
  }
}

export class NullAgentConsole implements AgentConsole {
  thinking(message: string) {}
  tool(message: string) {}
  assistant(message: string) {}
  user(message: string) {}
}

export function createAgentConsole(stdout: boolean): AgentConsole {
  if (stdout) {
    return new StdoutAgentConsole();
  }
  return new NullAgentConsole();
}
