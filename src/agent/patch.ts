import { $ } from "bun";

export interface Patch {
  hunks: PatchHunk[];
}

export interface PatchHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: string[];
}

export function parseHunk(lines: string[], i: number): [PatchHunk, number] {
  // Handle single line format (@@ -1 +1 @@)
  const singleLineHeaderMatch = lines[i].match(/@@ -(\d+) \+(\d+) @@/);
  if (singleLineHeaderMatch) {
    const oldStart = parseInt(singleLineHeaderMatch[1]);
    const newStart = parseInt(singleLineHeaderMatch[2]);
    const header = lines[i];

    const hunkLines: string[] = [];
    let j = i + 1;
    while (j < lines.length) {
      const line = lines[j];
      if (line.startsWith("\\ No newline at end of file")) {
        j++;
        continue;
      }
      if (
        !line.startsWith(" ") &&
        !line.startsWith("+") &&
        !line.startsWith("-")
      ) {
        break;
      }
      hunkLines.push(line);
      j++;
    }

    return [
      {
        oldStart,
        oldLines: 1,
        newStart,
        newLines: 1,
        header,
        lines: hunkLines,
      },
      j,
    ];
  }

  // Handle standard format (@@ -1,1 +1,1 @@)
  const headerMatch = lines[i].match(/@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);
  if (!headerMatch) {
    throw new Error(`Invalid hunk header: ${lines[i]}`);
  }

  const oldStart = parseInt(headerMatch[1]);
  const oldLines = parseInt(headerMatch[2]);
  const newStart = parseInt(headerMatch[3]);
  const newLines = parseInt(headerMatch[4]);
  const header = lines[i];

  const hunkLines: string[] = [];
  let j = i + 1;
  while (j < lines.length) {
    const line = lines[j];
    if (line.startsWith("\\ No newline at end of file")) {
      j++;
      continue;
    }
    if (
      !line.startsWith(" ") &&
      !line.startsWith("+") &&
      !line.startsWith("-")
    ) {
      break;
    }
    hunkLines.push(line);
    j++;
  }

  return [
    { oldStart, oldLines, newStart, newLines, header, lines: hunkLines },
    j,
  ];
}

export async function createRawPatch(
  file1: string,
  file2: string,
): Promise<string> {
  // use diff command to create unified format patch
  const diff = await Bun.spawn(["diff", "-u", file1, file2], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (diff.exitCode !== 0) {
    const text = await new Response(diff.stderr).text();
    throw new Error(`Failed to create patch: ${text}`);
  }
  const text = await new Response(diff.stdout).text();
  return text.trim();
}

export async function createRawPatchFromString(
  content1: string,
  content2: string,
): Promise<string> {
  // create temp files with random names to avoid conflicts
  const tmpDir = "./tmp";
  if (!(await Bun.file(tmpDir).exists())) {
    await Bun.spawn(["mkdir", "-p", tmpDir]);
  }
  const file1 = `${tmpDir}/${Math.random().toString(36).slice(2)}.txt`;
  const file2 = `${tmpDir}/${Math.random().toString(36).slice(2)}.txt`;
  await Bun.write(file1, content1);
  await Bun.write(file2, content2);
  // use diff command to create unified format patch
  const diff = await Bun.spawn(
    ["diff", "-u", "--label", "file1", file1, "--label", "file2", file2],
    {
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  await diff.exited;
  if (diff.exitCode === 2) {
    const text = await new Response(diff.stderr).text();
    throw new Error(`Failed to create patch: ${text}`);
  }
  // remove temp files
  await Bun.file(file1).delete();
  await Bun.file(file2).delete();

  const text = await new Response(diff.stdout).text();
  return text.trim();
}

export function createPatchFromDiff(diff: string): Patch {
  const hunks: PatchHunk[] = [];
  const lines = diff.split("\n");
  let i = 0;

  // Skip file headers (---, +++)
  while (
    i < lines.length &&
    (lines[i].startsWith("---") || lines[i].startsWith("+++"))
  ) {
    i++;
  }

  while (i < lines.length) {
    if (lines[i].startsWith("@@")) {
      const [hunk, nextIndex] = parseHunk(lines, i);
      hunks.push(hunk);
      i = nextIndex;
    } else {
      i++;
    }
  }

  return { hunks };
}

export function createPatch(src: string, dst: string): Patch {
  const srcLines = src.split("\n");
  const dstLines = dst.split("\n");
  const hunks: PatchHunk[] = [];
  const context = 1;

  // Find changed regions
  const changes: { start: number; end: number }[] = [];
  let i = 0;
  while (i < Math.max(srcLines.length, dstLines.length)) {
    // Skip identical lines
    while (
      i < srcLines.length &&
      i < dstLines.length &&
      srcLines[i] === dstLines[i]
    ) {
      i++;
    }

    if (i < srcLines.length || i < dstLines.length) {
      const changeStart = i;
      let changeEnd = i + 1;

      // Find the end of the changed region
      while (
        changeEnd < Math.max(srcLines.length, dstLines.length) &&
        (changeEnd >= srcLines.length ||
          changeEnd >= dstLines.length ||
          srcLines[changeEnd] !== dstLines[changeEnd])
      ) {
        changeEnd++;
      }

      // Record the change
      changes.push({ start: changeStart, end: changeEnd });
      i = changeEnd;
    }
  }

  // Determine whether to merge changes
  const mergedChanges: { start: number; end: number }[] = [];
  for (let i = 0; i < changes.length; i++) {
    const current = changes[i];
    const next = i + 1 < changes.length ? changes[i + 1] : null;

    // Calculate common lines between current and next change
    const commonLines = next ? next.start - current.end : Infinity;

    // Only merge if there are no common lines (no shared context)
    if (next && commonLines === 0) {
      mergedChanges.push({
        start: current.start,
        end: next.end,
      });
      i++; // Skip next change
    } else {
      mergedChanges.push(current);
    }
  }

  // Generate hunks after merging changes
  let previousHunkEnd = -1; // Track the end position of previous hunk
  for (let i = 0; i < mergedChanges.length; i++) {
    const change = mergedChanges[i];

    // If current change is within context lines of previous hunk, don't duplicate context
    let hunkStart: number;
    if (change.start <= previousHunkEnd + context) {
      hunkStart = change.start;
    } else {
      hunkStart = Math.max(0, change.start - context);
    }
    let hunkEnd = Math.min(
      Math.max(srcLines.length, dstLines.length),
      change.end + context,
    );

    const hunkLines: string[] = [];

    // Add leading context
    for (let k = hunkStart; k < change.start; k++) {
      if (k < srcLines.length && k < dstLines.length) {
        hunkLines.push(" " + srcLines[k]);
      }
    }

    // Add changed lines
    for (let k = change.start; k < change.end; k++) {
      if (k < srcLines.length) {
        hunkLines.push("-" + srcLines[k]);
      }
      if (k < dstLines.length) {
        hunkLines.push("+" + dstLines[k]);
      }
    }

    // Add trailing context
    for (let k = change.end; k < hunkEnd; k++) {
      if (k < srcLines.length && k < dstLines.length) {
        hunkLines.push(" " + srcLines[k]);
      }
    }

    // Calculate total lines (changes + context)
    const oldLines = hunkLines.filter((line) => line.startsWith("-")).length;
    const newLines = hunkLines.filter((line) => line.startsWith("+")).length;
    const contextLines = hunkLines.filter((line) =>
      line.startsWith(" "),
    ).length;
    const totalOldLines = oldLines + contextLines;
    const totalNewLines = newLines + contextLines;

    // Set hunk start position to hunkStart+1
    const oldStart = hunkStart + 1;
    const newStart = hunkStart + 1;
    // Use single line format when both old and new are single lines
    const header =
      totalOldLines === 1 && totalNewLines === 1
        ? `@@ -${oldStart} +${newStart} @@`
        : `@@ -${oldStart},${totalOldLines} +${newStart},${totalNewLines} @@`;

    hunks.push({
      oldStart,
      oldLines: totalOldLines,
      newStart,
      newLines: totalNewLines,
      header,
      lines: hunkLines,
    });

    // Record current hunk end position
    previousHunkEnd = change.end;
  }

  return { hunks };
}

export function checkPatchFormat(patch: Patch): boolean {
  if (!patch.hunks || !Array.isArray(patch.hunks)) {
    return false;
  }

  return patch.hunks.every((hunk) => {
    return (
      typeof hunk.oldStart === "number" &&
      typeof hunk.oldLines === "number" &&
      typeof hunk.newStart === "number" &&
      typeof hunk.newLines === "number" &&
      typeof hunk.header === "string" &&
      Array.isArray(hunk.lines) &&
      hunk.lines.every(
        (line) =>
          line.startsWith("+") || line.startsWith("-") || line.startsWith(" "),
      )
    );
  });
}

export function applyPatch(src: string, patch: Patch): string {
  let lines = src.split("\n");

  for (const hunk of patch.hunks) {
    const newLines: string[] = [];
    let currentLine = 0;

    // Copy lines before the hunk
    while (currentLine < hunk.oldStart - 1) {
      newLines.push(lines[currentLine]);
      currentLine++;
    }

    // Apply the hunk changes
    let hunkLineIndex = 0;
    while (hunkLineIndex < hunk.lines.length) {
      const line = hunk.lines[hunkLineIndex];
      if (line.startsWith("+")) {
        newLines.push(line.slice(1));
      } else if (line.startsWith("-")) {
        currentLine++;
      } else if (line.startsWith(" ")) {
        newLines.push(line.slice(1));
        currentLine++;
      }
      hunkLineIndex++;
    }

    // Copy remaining lines
    while (currentLine < lines.length) {
      newLines.push(lines[currentLine]);
      currentLine++;
    }

    lines = newLines;
  }

  return lines.join("\n");
}
