import winston from "winston";
import { Message } from "./llm";

export interface LLMLogger {
  log(message: string): void;
  logRequest(systemPrompt: string, messages: Message[]): void;
}

export function createLLMLogger(logFile: string | undefined): LLMLogger {
  const logger = winston.createLogger({
    level: "info",
    format: winston.format.simple(),
    transports: [
      new winston.transports.Console({
        format: winston.format.simple(),
        level: "error",
      }),
    ],
  });

  if (logFile) {
    logger.add(new winston.transports.File({ filename: logFile }));
  }

  return {
    log: (message: string) => logger.info(message),
    logRequest: (systemPrompt: string, messages: Message[]) => {
      logger.info(
        "LLM Request =================================================",
      );
      logger.info(`System Prompt: ${systemPrompt}`);
      const userPrompts = messages.map((message) => {
        return `${message.role}: ${message.content}`;
      });
      logger.info(userPrompts.join("\n----------\n"));
      logger.info(
        "END OF LLM Request =================================================",
      );
    },
  };
}
