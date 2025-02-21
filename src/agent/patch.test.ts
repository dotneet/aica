import { expect, test, describe } from "bun:test";
import {
  createPatch,
  checkPatchFormat,
  applyPatch,
  parseHunk,
  createPatchFromDiff,
} from "./patch";

describe("Patch機能のテスト", () => {
  test("createPatch - unified formatでの差分生成", () => {
    const src = "hello\nworld";
    const dst = "hello\nthere\nworld";
    const patch = createPatch(src, dst);

    expect(patch.hunks).toHaveLength(1);
    const hunk = patch.hunks[0];
    expect(hunk.header).toBe("@@ -1,2 +1,3 @@");
    expect(hunk.lines).toEqual([" hello", "-world", "+there", "+world"]);
  });

  test("checkPatchFormat - 正しいunifiedパッチフォーマット", () => {
    const patch = {
      hunks: [
        {
          oldStart: 1,
          oldLines: 1,
          newStart: 1,
          newLines: 1,
          header: "@@ -1,1 +1,1 @@",
          lines: [" context", "-old", "+new"],
        },
      ],
    };
    expect(checkPatchFormat(patch)).toBe(true);
  });

  test("checkPatchFormat - 不正なパッチフォーマット", () => {
    const invalidPatch = {
      hunks: [
        {
          oldStart: "1",
          oldLines: 1,
          newStart: 1,
          newLines: 1,
          lines: ["invalid"],
        },
      ],
    };
    expect(checkPatchFormat(invalidPatch as any)).toBe(false);
  });

  test("applyPatch - unified formatパッチの適用", () => {
    const src = "line1\nline2\nline3";
    const patch = {
      hunks: [
        {
          oldStart: 1,
          oldLines: 3,
          newStart: 1,
          newLines: 3,
          header: "@@ -1,3 +1,3 @@",
          lines: [" line1", "-line2", "+newline2", " line3"],
        },
      ],
    };
    const result = applyPatch(src, patch);
    expect(result).toBe("line1\nnewline2\nline3");
  });

  test("完全なワークフロー - unified format", () => {
    const original = "first\nsecond\nthird\nfourth\nfifth";
    const modified = "first\nmodified\nthird\nchanged\nfifth";

    // パッチの作成
    const patch = createPatch(original, modified);

    // パッチフォーマットの確認
    expect(checkPatchFormat(patch)).toBe(true);

    // ハンクの内容を確認
    expect(patch.hunks).toHaveLength(2);
    expect(patch.hunks[0].header).toBe("@@ -1,3 +1,3 @@");
    expect(patch.hunks[0].lines).toEqual([
      " first",
      "-second",
      "+modified",
      " third",
    ]);

    expect(patch.hunks[1].header).toBe("@@ -4,2 +4,2 @@");
    expect(patch.hunks[1].lines).toEqual(["-fourth", "+changed", " fifth"]);

    // パッチの適用
    const result = applyPatch(original, patch);
    expect(result).toBe(modified);
  });
});

describe("parseHunk", () => {
  test("unified formatのハンクをパースできること", () => {
    const lines = ["@@ -1,2 +1,2 @@", " unchanged", "-old line", "+new line"];

    const [result, nextIndex] = parseHunk(lines, 0);

    expect(result).toEqual({
      oldStart: 1,
      oldLines: 2,
      newStart: 1,
      newLines: 2,
      header: "@@ -1,2 +1,2 @@",
      lines: [" unchanged", "-old line", "+new line"],
    });
    expect(nextIndex).toBe(4);
  });

  test("不正なヘッダーでエラーを投げること", () => {
    const lines = ["invalid header"];
    expect(() => parseHunk(lines, 0)).toThrow("Invalid hunk header");
  });
});

describe("createPatchFromDiff", () => {
  test("unified formatのdiffから正しくパッチを生成できること", () => {
    const diff = [
      "--- a/file",
      "+++ b/file",
      "@@ -1,2 +1,2 @@",
      " unchanged",
      "-old line",
      "+new line",
    ].join("\n");

    const result = createPatchFromDiff(diff);

    expect(result).toEqual({
      hunks: [
        {
          oldStart: 1,
          oldLines: 2,
          newStart: 1,
          newLines: 2,
          header: "@@ -1,2 +1,2 @@",
          lines: [" unchanged", "-old line", "+new line"],
        },
      ],
    });
  });

  test("複数のハンクを含むunified formatのdiffを処理できること", () => {
    const diff = [
      "--- a/file",
      "+++ b/file",
      "@@ -1,3 +1,3 @@",
      " first",
      "-second",
      "+modified",
      "@@ -5,2 +5,2 @@",
      "-fifth",
      "+changed",
    ].join("\n");

    const result = createPatchFromDiff(diff);

    expect(result).toEqual({
      hunks: [
        {
          oldStart: 1,
          oldLines: 3,
          newStart: 1,
          newLines: 3,
          header: "@@ -1,3 +1,3 @@",
          lines: [" first", "-second", "+modified"],
        },
        {
          oldStart: 5,
          oldLines: 2,
          newStart: 5,
          newLines: 2,
          header: "@@ -5,2 +5,2 @@",
          lines: ["-fifth", "+changed"],
        },
      ],
    });
  });
});
