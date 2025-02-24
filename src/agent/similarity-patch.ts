/**
 * Implementation example of the following specifications:
 *
 * 1. Parse unified diff patches (multiple Hunks)
 * 2. Extract lines starting with '-', '+' and context lines for each Hunk
 * 3. Apply changes to the most similar location in the text, using deletion/addition lines and surrounding context
 * 4. Similarity is based on simple line-by-line matching (example)
 */

/**
 * Split text into lines and return as array
 */
export function splitTextIntoLines(text: string): string[] {
  return text.replace(/\r\n/g, "\n").split("\n");
}

/**
 * Reconstruct text from array of lines
 */
export function joinLinesIntoText(lines: string[]): string {
  return lines.join("\n");
}

/**
 * Type representing the entire diff
 */
interface UnifiedDiff {
  hunks: Hunk[];
}

interface Hunk {
  header: string; // "@@ ... @@"
  lines: string[]; // All patch lines (including -/+/context)
}

/**
 * Parse unified diff string and return split Hunks
 */
export function parseUnifiedDiff(diffText: string): UnifiedDiff {
  const lines = splitTextIntoLines(diffText);

  // パッチのバリデーション
  if (!lines.some((line) => line.startsWith("@@"))) {
    throw new Error("Invalid patch format: No hunk headers found");
  }

  const hunks: Hunk[] = extractHunks(lines);
  if (hunks.length === 0) {
    throw new Error("Invalid patch format: No hunks found");
  }
  return { hunks };
}

/**
 * Extract Hunks using '@@ ... @@' lines as headers, grouping subsequent patch lines
 */
export function extractHunks(diffLines: string[]): Hunk[] {
  const hunks: Hunk[] = [];
  let currentHunk: Hunk | null = null;

  for (const line of diffLines) {
    if (line.startsWith("@@")) {
      // Start of a new Hunk
      if (currentHunk) {
        hunks.push(currentHunk);
      }
      currentHunk = { header: line, lines: [] };
    } else {
      if (!currentHunk) {
        // Skip lines before reaching the header
        continue;
      }
      currentHunk.lines.push(line);
    }
  }
  // Push the last Hunk
  if (currentHunk) {
    hunks.push(currentHunk);
  }
  return hunks;
}

/**
 * Split Hunk lines into deletion lines (starting with -), addition lines (starting with +),
 * and context lines (lines without markers before and after)
 */
export interface HunkSegments {
  minusLines: string[]; // Continuous block starting with '-'
  plusLines: string[]; // Continuous block starting with '+'
  contextLinesBefore: string[]; // Context lines before the block
  contextLinesAfter: string[];
}

export function splitHunkIntoSegments(hunk: Hunk): HunkSegments[] {
  const segments: HunkSegments[] = [];
  let minusBuffer: string[] = [];
  let plusBuffer: string[] = [];
  let contextBefore: string[] = [];
  let contextAfter: string[] = [];

  for (let i = 0; i < hunk.lines.length; i++) {
    const line = hunk.lines[i];
    const nextLine = i < hunk.lines.length - 1 ? hunk.lines[i + 1] : null;

    if (line.startsWith("-")) {
      minusBuffer.push(line.substring(1));
    } else if (line.startsWith("+")) {
      plusBuffer.push(line.substring(1));
    } else {
      // For context lines
      const lineContent = line.substring(1);
      if (minusBuffer.length > 0 || plusBuffer.length > 0) {
        // End of change block
        segments.push({
          minusLines: [...minusBuffer],
          plusLines: [...plusBuffer],
          contextLinesBefore: [...contextBefore],
          contextLinesAfter: [lineContent],
        });
        minusBuffer = [];
        plusBuffer = [];
        contextBefore = [lineContent];
        contextAfter = [];
      } else {
        // Check if the next line is a change line
        if (
          nextLine &&
          (nextLine.startsWith("-") || nextLine.startsWith("+"))
        ) {
          contextBefore.push(lineContent);
        } else {
          contextAfter.push(lineContent);
        }
      }
    }
  }

  // Flush remaining buffers
  if (minusBuffer.length > 0 || plusBuffer.length > 0) {
    segments.push({
      minusLines: [...minusBuffer],
      plusLines: [...plusBuffer],
      contextLinesBefore: [...contextBefore],
      contextLinesAfter: [...contextAfter],
    });
  }

  return segments;
}

/**
 * Calculate similarity between two string arrays. In this example, simply returns the count of matching lines
 */
export function computeSimilarity(blockA: string[], blockB: string[]): number {
  // Use line-by-line exact match count as score
  let score = 0;
  const minLen = Math.min(blockA.length, blockB.length);
  for (let i = 0; i < minLen; i++) {
    if (blockA[i] === blockB[i]) {
      score += 1;
    }
  }
  return score;
}

/**
 * Find the starting position of the most similar continuous block to targetBlock in originalText
 */
export function findMostSimilarBlockIndex(
  originalLines: string[],
  targetBlock: string[],
): number {
  if (targetBlock.length === 0 || originalLines.length === 0) {
    return 0;
  }
  let bestScore = -1;
  let bestIndex = 0;
  for (
    let start = 0;
    start <= originalLines.length - targetBlock.length;
    start++
  ) {
    const slice = originalLines.slice(start, start + targetBlock.length);
    const similarity = computeSimilarity(slice, targetBlock);
    if (similarity > bestScore) {
      bestScore = similarity;
      bestIndex = start;
    }
  }
  return bestIndex;
}

/**
 * Example of applying a patch by:
 * 1. Using similarity to find matching locations
 * 2. Removing deletion blocks
 * 3. Inserting addition blocks
 */
export function applyPatchWithSimilarity(
  originalText: string,
  patchText: string,
): string {
  const originalLines = splitTextIntoLines(originalText);
  const unifiedDiff = parseUnifiedDiff(patchText);
  const updatedLines = [...originalLines];

  for (const hunk of unifiedDiff.hunks) {
    const segments = splitHunkIntoSegments(hunk);

    for (const segment of segments) {
      // Find position for deletion/replacement
      const searchBlock = [
        ...segment.contextLinesBefore,
        ...(segment.minusLines.length > 0 ? segment.minusLines : []),
        ...segment.contextLinesAfter,
      ];

      // If search block is empty (pure addition case)
      if (searchBlock.length === 0) {
        const contextIndex =
          segment.contextLinesBefore.length > 0
            ? findMostSimilarBlockIndex(
                updatedLines,
                segment.contextLinesBefore,
              )
            : updatedLines.length;
        updatedLines.splice(
          contextIndex + segment.contextLinesBefore.length,
          0,
          ...segment.plusLines,
        );
        continue;
      }

      // Identify deletion position
      const matchIndex = findMostSimilarBlockIndex(updatedLines, searchBlock);

      // Execute deletion (only if minusLines exist)
      if (segment.minusLines.length > 0) {
        const deleteStart = matchIndex + segment.contextLinesBefore.length;
        // Check if the target lines actually match
        const targetLines = updatedLines.slice(
          deleteStart,
          deleteStart + segment.minusLines.length,
        );
        const similarity = computeSimilarity(targetLines, segment.minusLines);
        if (similarity > 0) {
          // Calculate deletion range
          updatedLines.splice(deleteStart, segment.minusLines.length);
          // If there are lines to add, insert them at the deletion position
          if (segment.plusLines.length > 0) {
            updatedLines.splice(deleteStart, 0, ...segment.plusLines);
          }
          // Add context lines after (only if existing lines don't match)
          if (segment.contextLinesAfter.length > 0) {
            const nextLines = updatedLines.slice(
              deleteStart + segment.plusLines.length,
              deleteStart +
                segment.plusLines.length +
                segment.contextLinesAfter.length,
            );
            if (computeSimilarity(nextLines, segment.contextLinesAfter) === 0) {
              updatedLines.splice(
                deleteStart + segment.plusLines.length,
                0,
                ...segment.contextLinesAfter,
              );
            }
          }
        }
      } else if (segment.plusLines.length > 0) {
        // If no deletion, add after context lines
        const insertIndex = matchIndex + segment.contextLinesBefore.length;
        updatedLines.splice(insertIndex, 0, ...segment.plusLines);
        // Add context lines after (only if existing lines don't match)
        if (segment.contextLinesAfter.length > 0) {
          const nextLines = updatedLines.slice(
            insertIndex + segment.plusLines.length,
            insertIndex +
              segment.plusLines.length +
              segment.contextLinesAfter.length,
          );
          if (computeSimilarity(nextLines, segment.contextLinesAfter) === 0) {
            updatedLines.splice(
              insertIndex + segment.plusLines.length,
              0,
              ...segment.contextLinesAfter,
            );
          }
        }
      }

      // コンテキスト行の後ろを追加（既存の行が一致しない場合のみ）
      if (
        segment.contextLinesAfter.length > 0 &&
        !segment.minusLines.length &&
        !segment.plusLines.length
      ) {
        const afterIndex = matchIndex + segment.contextLinesBefore.length;
        const nextLines = updatedLines.slice(
          afterIndex,
          afterIndex + segment.contextLinesAfter.length,
        );
        if (computeSimilarity(nextLines, segment.contextLinesAfter) === 0) {
          updatedLines.splice(afterIndex, 0, ...segment.contextLinesAfter);
        }
      }
    }
  }

  return joinLinesIntoText(updatedLines);
}
