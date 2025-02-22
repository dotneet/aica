import winston from "winston";

export interface LLMLogger {
  log(message: string): void;
}

export function createLLMLogger(logFile: string | undefined): LLMLogger {
  const logger = winston.createLogger({
    level: "info",
    format: winston.format.simple(),
    transports: [],
  });

  if (logFile) {
    logger.add(new winston.transports.File({ filename: logFile }));
  }

  return {
    log: (message: string) => logger.info(message),
  };
}
