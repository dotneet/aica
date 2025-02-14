export class CommandError extends Error {
  constructor(message: string, cause?: Error) {
    super(message, { cause });
  }
}
