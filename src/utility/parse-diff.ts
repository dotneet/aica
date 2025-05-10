export type ChangeType = "add" | "remove" | "modify";

export interface FileChange {
  filename: string;
  changeType: ChangeType;
  diff: string;
}

export function parseDiff(diffOutput: string): FileChange[] {
  const files: FileChange[] = [];
  const diffParts = diffOutput.split("diff --git ");
  for (const part of diffParts.slice(1)) {
    const lines = part.split("\n");
    const header = lines[0];
    const filenameMatch = header.match(/b\/(.*)/);
    if (!filenameMatch) continue;

    const filename = filenameMatch[1];
    const isNewFile = part.includes("new file mode");
    const changeType: ChangeType = isNewFile ? "add" : "modify";

    files.push({
      filename,
      changeType,
      diff: part,
    });
  }

  return files;
}
