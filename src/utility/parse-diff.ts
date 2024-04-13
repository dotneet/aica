export type ChangeType = "add" | "remove" | "modify";

export interface FileChange {
  filename: string;
  changeType: ChangeType;
  changes: string[];
}

const ignoredLines = ["--- /dev/null"];

export function parseDiff(diffOutput: string): FileChange[] {
  const files: FileChange[] = [];
  const diffParts = diffOutput.split("diff --git ");
  diffParts.slice(1).forEach((part) => {
    const lines = part.split("\n");
    const header = lines[0];
    const filenameMatch = header.match(/b\/(.*)/);
    if (!filenameMatch) return;

    const filename = filenameMatch[1];
    const isNewFile = part.includes("new file mode");
    const changeType: ChangeType = isNewFile ? "add" : "modify";
    const changeLines = lines
      .filter((line) => line.startsWith("+") || line.startsWith("-"))
      .filter((line) => !ignoredLines.includes(line));

    files.push({
      filename,
      changeType,
      changes: changeLines,
    });
  });

  return files;
}
