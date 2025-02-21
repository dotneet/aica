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
  while (
    j < lines.length &&
    (lines[j].startsWith(" ") ||
      lines[j].startsWith("+") ||
      lines[j].startsWith("-"))
  ) {
    hunkLines.push(lines[j]);
    j++;
  }

  return [
    { oldStart, oldLines, newStart, newLines, header, lines: hunkLines },
    j,
  ];
}

export function createPatchFromDiff(diff: string): Patch {
  const hunks: PatchHunk[] = [];
  const lines = diff.split("\n").filter((line) => line.length > 0);
  let i = 0;

  // Skip file headers (---, +++)
  while (
    i < lines.length &&
    (lines[i].startsWith("---") || lines[i].startsWith("+++"))
  ) {
    i++;
  }

  while (i < lines.length) {
    const [hunk, nextIndex] = parseHunk(lines, i);
    hunks.push(hunk);
    i = nextIndex;
  }

  return { hunks };
}

export function createPatch(src: string, dst: string): Patch {
  const srcLines = src.split("\n");
  const dstLines = dst.split("\n");
  const hunks: PatchHunk[] = [];
  const context = 1;

  // 変更箇所を見つける
  const changes: { start: number; end: number }[] = [];
  let i = 0;
  while (i < Math.max(srcLines.length, dstLines.length)) {
    // 同じ行をスキップ
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

      // 変更箇所の終わりを見つける
      while (
        changeEnd < Math.max(srcLines.length, dstLines.length) &&
        (changeEnd >= srcLines.length ||
          changeEnd >= dstLines.length ||
          srcLines[changeEnd] !== dstLines[changeEnd])
      ) {
        changeEnd++;
      }

      // 変更箇所を記録
      changes.push({ start: changeStart, end: changeEnd });
      i = changeEnd;
    }
  }

  // 変更箇所をマージするかどうかを判断
  const mergedChanges: { start: number; end: number }[] = [];
  for (let i = 0; i < changes.length; i++) {
    const current = changes[i];
    const next = i + 1 < changes.length ? changes[i + 1] : null;

    // 次の変更箇所との間の共通行数を計算
    const commonLines = next ? next.start - current.end : Infinity;

    // 共通行が0行の場合のみマージ（コンテキスト行を共有しない場合）
    if (next && commonLines === 0) {
      mergedChanges.push({
        start: current.start,
        end: next.end,
      });
      i++; // 次の変更箇所をスキップ
    } else {
      mergedChanges.push(current);
    }
  }

  // 各変更箇所をマージ後、ハンクを生成
  let previousHunkEnd = -1; // 前のハンクの終了位置を追跡しておく
  for (let i = 0; i < mergedChanges.length; i++) {
    const change = mergedChanges[i];

    // もし前のハンクと現在の変更箇所がcontext行数以内の場合、コンテキストを重複させない
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

    // 前のコンテキストを追加
    for (let k = hunkStart; k < change.start; k++) {
      if (k < srcLines.length && k < dstLines.length) {
        hunkLines.push(" " + srcLines[k]);
      }
    }

    // 変更箇所を追加
    for (let k = change.start; k < change.end; k++) {
      if (k < srcLines.length) {
        hunkLines.push("-" + srcLines[k]);
      }
      if (k < dstLines.length) {
        hunkLines.push("+" + dstLines[k]);
      }
    }

    // 後ろのコンテキストを追加
    for (let k = change.end; k < hunkEnd; k++) {
      if (k < srcLines.length && k < dstLines.length) {
        hunkLines.push(" " + srcLines[k]);
      }
    }

    // 変更箇所+コンテキスト行数を算出
    const oldLines = hunkLines.filter((line) => line.startsWith("-")).length;
    const newLines = hunkLines.filter((line) => line.startsWith("+")).length;
    const contextLines = hunkLines.filter((line) =>
      line.startsWith(" "),
    ).length;
    const totalOldLines = oldLines + contextLines;
    const totalNewLines = newLines + contextLines;

    // ハンクの開始位置を hunkStart+1
    const oldStart = hunkStart + 1;
    const newStart = hunkStart + 1;
    const header = `@@ -${oldStart},${totalOldLines} +${newStart},${totalNewLines} @@`;

    hunks.push({
      oldStart,
      oldLines: totalOldLines,
      newStart,
      newLines: totalNewLines,
      header,
      lines: hunkLines,
    });

    // 現在のハンク終了位置を記録
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
