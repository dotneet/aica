import chalk from "chalk";

export interface AgentConsole {
  thinking(message: string): void;
  tool(message: string): void;
  assistant(message: string): void;
  user(message: string): void;
}

export class StdoutAgentConsole implements AgentConsole {
  constructor(private readonly color: boolean = true) {}
  thinking(message: string) {
    if (this.color) {
      console.log(chalk.gray(`<thinking>\n${message}\n</thinking>`));
    } else {
      console.log(`<thinking>\n${message}\n</thinking>`);
    }
  }

  tool(message: string) {
    if (this.color) {
      console.log(chalk.green(message));
    } else {
      console.log(message);
    }
  }

  assistant(message: string) {
    if (this.color) {
      console.log(chalk.blue(message));
    } else {
      console.log(message);
    }
  }

  user(message: string) {
    if (this.color) {
      console.log(chalk.yellow(message));
    } else {
      console.log(message);
    }
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
