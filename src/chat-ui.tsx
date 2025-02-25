#!/usr/bin/env bun
import { useState, useEffect, useRef } from "react";
import {
  render,
  Box,
  Text,
  useInput,
  useApp,
  Spacer,
  useFocus,
  useFocusManager,
} from "ink";
// Fix for ink-spinner module import error
// @ts-ignore
import Spinner from "ink-spinner";
import { Agent } from "@/agent/agent";
import { GitRepository } from "@/git";
import { createLLM } from "@/llm/factory";
import { readConfig, type Config } from "@/config";
import * as path from "node:path";
import * as fs from "node:fs";
// chalk only supports ESM, so fix the import
import chalk from "chalk";

// Constants
const WELCOME_MESSAGE = "Welcome to AICA Project! How can I assist you today?";
const MAX_HISTORY_SIZE = 50;
const COMMANDS = {
  EXIT: ["/exit", "/quit"],
  HELP: ["/help", "/?"],
  CLEAR: ["/clear", "/cls"],
};

// Type definitions
type MessageRole = "user" | "assistant" | "system";

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
}

interface CommandHandler {
  commands: string[];
  description: string;
  handler: (args: string) => void | Promise<void>;
}

// Utility functions
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15);
};

const formatTimestamp = (date: Date): string => {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Console message output functions
const printHeader = () => {
  console.log(`\n${chalk.cyan.bold("=== AICA Chat Assistant ===")}\n`);
};

const printMessage = (role: MessageRole, content: string, timestamp: Date) => {
  const time = formatTimestamp(timestamp);

  if (role === "user") {
    console.log(`${chalk.green("You")} [${chalk.gray(time)}]:`);
    console.log(`  ${content.split("\n").join("\n  ")}`);
  } else if (role === "assistant") {
    console.log(`${chalk.cyan("AI Assistant")} [${chalk.gray(time)}]:`);
    console.log(`  ${content.split("\n").join("\n  ")}`);
  } else if (role === "system") {
    console.log(`${chalk.yellow("System")} [${chalk.gray(time)}]: ${content}`);
  }
  console.log(); // Add empty line
};

const printProcessingIndicator = () => {
  console.log(chalk.yellow("Processing..."));
};

const clearConsole = () => {
  console.clear();
};

// Input field component
const InputField: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isDisabled?: boolean;
}> = ({ value, onChange, onSubmit, isDisabled = false }) => {
  const { focus } = useFocusManager();
  const [cursorPosition, setCursorPosition] = useState(value.length);
  const prevValueRef = useRef(value);

  useEffect(() => {
    focus("input-field");
  }, [focus]);

  // 初期化時のみカーソル位置を更新
  useEffect(() => {
    // 初期化時のみカーソルを末尾に設定
    if (prevValueRef.current === "" && value !== "") {
      setCursorPosition(value.length);
    }
    prevValueRef.current = value;
  }, [value]);

  // 値の変更とカーソル位置を同時に管理する関数
  const handleChange = (newValue: string, newCursorPosition: number) => {
    onChange(newValue);
    setCursorPosition(newCursorPosition);
  };

  useFocus({ id: "input-field", autoFocus: true });

  // カーソル位置に基づいて表示するテキストを生成
  const displayText = () => {
    if (!value) return "Enter your message...";

    // 改行を処理するために文字列を行に分割
    const lines = value.split("\n");
    let currentPos = 0;
    let cursorLine = 0;
    let cursorCol = 0;

    // カーソル位置がある行と列を特定
    for (let i = 0; i < lines.length; i++) {
      if (currentPos + lines[i].length >= cursorPosition) {
        cursorLine = i;
        cursorCol = cursorPosition - currentPos;
        break;
      }
      // 改行文字も位置としてカウント
      currentPos += lines[i].length + 1;
    }

    // 各行を処理して、カーソル位置に背景色を適用
    return (
      <Box flexDirection="column">
        {lines.map((line, lineIndex) => {
          // 各行に一意のキーを生成
          const lineKey = `line-${lineIndex}-${line.substring(0, 3)}`;

          if (lineIndex === cursorLine) {
            // カーソルがある行
            const beforeCursor = line.slice(0, cursorCol);
            const atCursor = line.charAt(cursorCol) || " ";
            const afterCursor = line.slice(cursorCol + 1);

            return (
              <Box key={lineKey}>
                <Text>{beforeCursor}</Text>
                <Text backgroundColor="cyan">{atCursor}</Text>
                <Text>{afterCursor}</Text>
              </Box>
            );
          }

          // カーソルがない行
          return (
            <Box key={lineKey}>
              <Text>{line}</Text>
            </Box>
          );
        })}
      </Box>
    );
  };

  // 改行の挿入処理
  const handleNewLine = () => {
    const newValue = `${value.slice(0, cursorPosition)}\n${value.slice(
      cursorPosition,
    )}`;
    handleChange(newValue, cursorPosition + 1);
  };

  useInput(
    (input, key) => {
      if (isDisabled) return;

      if (key.return) {
        onSubmit();
      } else if (key.delete || key.backspace) {
        if (cursorPosition > 0) {
          // カーソル位置の前の文字を削除
          const newValue =
            value.slice(0, cursorPosition - 1) + value.slice(cursorPosition);
          handleChange(newValue, cursorPosition - 1);
        }
      } else if (key.escape) {
        // Clear input with Esc key
        handleChange("", 0);
      } else if (key.leftArrow) {
        // カーソルを左に移動
        setCursorPosition(Math.max(0, cursorPosition - 1));
      } else if (key.rightArrow) {
        // カーソルを右に移動
        setCursorPosition(Math.min(value.length, cursorPosition + 1));
      } else if (input === "\n") {
        handleNewLine();
      } else if (!key.ctrl && !key.meta && input.length > 0) {
        // カーソル位置に文字を挿入
        const newValue =
          value.slice(0, cursorPosition) + input + value.slice(cursorPosition);
        handleChange(newValue, cursorPosition + input.length);
      }
    },
    { isActive: !isDisabled },
  );

  return (
    <Box flexDirection="column" width="100%">
      <Box
        borderStyle="round"
        borderColor={isDisabled ? "gray" : "cyan"}
        padding={1}
        width="100%"
      >
        {value ? (
          displayText()
        ) : (
          <Text color={isDisabled ? "gray" : "white"}>
            Enter your message...
          </Text>
        )}
      </Box>
      <Box padding={0} width="100%">
        <Text dimColor>
          <Text color="cyan">/help</Text> Command list •{" "}
          <Text color="cyan">Esc</Text> Clear input •{" "}
          <Text color="cyan">←→</Text> Move cursor •{" "}
          <Text color="cyan">Ctrl+C</Text> Exit
        </Text>
      </Box>
    </Box>
  );
};

// Main chat component
const Chat: React.FC<{ agent: Agent }> = ({ agent }) => {
  const { exit } = useApp();
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Display initial message
  useEffect(() => {
    printHeader();
    printMessage("assistant", WELCOME_MESSAGE, new Date());
  }, []);

  // Command handler definitions
  const commandHandlers: CommandHandler[] = [
    {
      commands: COMMANDS.EXIT,
      description: "Exit the chat",
      handler: () => exit(),
    },
    {
      commands: COMMANDS.HELP,
      description: "Display available commands",
      handler: () => {
        const helpContent = `Available commands:\n${commandHandlers
          .map((h) => `${h.commands.join(", ")} - ${h.description}`)
          .join("\n")}`;
        printMessage("system", helpContent, new Date());
      },
    },
    {
      commands: COMMANDS.CLEAR,
      description: "Clear chat history",
      handler: () => {
        clearConsole();
        printHeader();
        printMessage("system", "Chat history cleared.", new Date());
      },
    },
  ];

  // Key input handling (history navigation)
  useInput((inputChar, key) => {
    if (isProcessing) return;

    if (key.upArrow && history.length > 0) {
      // Navigate back in history
      const newIndex = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(newIndex);
      setInput(history[newIndex]);
    } else if (key.downArrow && historyIndex >= 0) {
      // Navigate forward in history
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setInput(newIndex >= 0 ? history[newIndex] : "");
    } else if (key.ctrl && inputChar === "c") {
      exit();
    }
  });

  // Command processing function
  const handleCommand = (text: string): boolean => {
    const trimmedText = text.trim();

    for (const handler of commandHandlers) {
      if (handler.commands.some((cmd) => trimmedText.toLowerCase() === cmd)) {
        handler.handler("");
        return true;
      }
    }

    return false;
  };

  // Function to send message
  const sendMessage = async () => {
    if (input.trim() === "") return;

    // Command processing
    if (handleCommand(input)) {
      setInput("");
      return;
    }

    // Add to history
    const newHistory = [input, ...history].slice(0, MAX_HISTORY_SIZE);
    setHistory(newHistory);
    setHistoryIndex(-1);

    // Display user message
    printMessage("user", input, new Date());
    setIsProcessing(true);
    setInput("");

    // Show processing indicator
    printProcessingIndicator();

    try {
      // Send prompt to Agent
      const result = await agent.plan(input);

      // Display response
      printMessage("assistant", result.response, new Date());
    } catch (error) {
      // Display error message
      const errorMessage = `An error occurred: ${
        error instanceof Error ? error.message : String(error)
      }`;
      printMessage("system", errorMessage, new Date());
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Box flexDirection="column" padding={0} width="100%">
      {/* Only manage input area with Ink */}
      <InputField
        value={input}
        onChange={setInput}
        onSubmit={sendMessage}
        isDisabled={isProcessing}
      />
    </Box>
  );
};

// Main function
const main = async () => {
  try {
    const config = await readConfig();
    if (!config) {
      console.error("Failed to load configuration file");
      process.exit(1);
    }

    // Initialize Git repository
    const gitRepo = new GitRepository(process.cwd());

    // Initialize LLM
    const llm = createLLM(config.llm);

    // Initialize Agent
    const agent = new Agent(gitRepo, llm, config);

    // Clear console
    clearConsole();

    // Render UI
    render(<Chat agent={agent} />);

    // Cleanup
    process.on("SIGINT", async () => {
      await agent[Symbol.asyncDispose]();
      process.exit(0);
    });
  } catch (error) {
    console.error("An error occurred:", error);
    process.exit(1);
  }
};

// Execute main function if script is run directly
if (require.main === module) {
  main();
}
