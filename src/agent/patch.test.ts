import { expect, test, describe } from "bun:test";
import { tmpdir } from "os";
import { join } from "path";
import {
  createPatch,
  checkPatchFormat,
  applyPatch,
  parseHunk,
  createPatchFromDiff,
} from "./patch";

describe("Patch functionality tests", () => {
  test("createPatch - generating unified format diff", () => {
    const src = "hello\nworld";
    const dst = "hello\nthere\nworld";
    const patch = createPatch(src, dst);

    expect(patch.hunks).toHaveLength(1);
    const hunk = patch.hunks[0];
    expect(hunk.header).toBe("@@ -1,2 +1,3 @@");
    expect(hunk.lines).toEqual([" hello", "-world", "+there", "+world"]);
  });

  test("checkPatchFormat - correct unified patch format", () => {
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

  test("checkPatchFormat - incorrect patch format", () => {
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

  test("applyPatch - applying unified format patch", () => {
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

  test("complete workflow - unified format", () => {
    const original = "first\nsecond\nthird\nfourth\nfifth";
    const modified = "first\nmodified\nthird\nchanged\nfifth";

    // Create patch
    const patch = createPatch(original, modified);

    // Check patch format
    expect(checkPatchFormat(patch)).toBe(true);

    // Check hunk content
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

    // Apply patch
    const result = applyPatch(original, patch);
    expect(result).toBe(modified);
  });
});

describe("parseHunk", () => {
  test("should parse unified format hunk correctly", () => {
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

  test("should throw error for invalid header", () => {
    const lines = ["invalid header"];
    expect(() => parseHunk(lines, 0)).toThrow("Invalid hunk header");
  });
});

describe("createPatchFromDiff", () => {
  test("should generate patch correctly from unified format diff", () => {
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

  test("should handle multiple hunks in unified format diff", () => {
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

describe("Comparison tests with actual diff/patch commands", () => {
  // Helper function to create and manage temporary files
  async function withTempFiles(
    originalContent: string,
    modifiedContent: string,
    callback: (originalFile: string, modifiedFile: string) => Promise<void>,
  ) {
    const timestamp = Date.now();
    const originalFile = join(tmpdir(), `patch-test-original-${timestamp}.txt`);
    const modifiedFile = join(tmpdir(), `patch-test-modified-${timestamp}.txt`);

    try {
      await Bun.write(originalFile, originalContent);
      await Bun.write(modifiedFile, modifiedContent);
      await callback(originalFile, modifiedFile);
    } finally {
      // Clean up temporary files
      await Bun.write(originalFile, "");
      await Bun.write(modifiedFile, "");
      await Bun.spawn(["rm", originalFile, modifiedFile]);
    }
  }

  test("should handle complex text modifications", async () => {
    const originalContent = [
      "# Sample Document",
      "",
      "This is a test document.",
      "It has multiple lines.",
      "Some lines will be modified.",
      "Some will be deleted.",
      "And some new lines will be added.",
      "",
      "## Section 1",
      "Content in section 1",
      "",
      "## Section 2",
      "Content in section 2",
    ].join("\n");

    const modifiedContent = [
      "# Modified Document",
      "",
      "This is a modified test document.",
      "It has multiple lines.",
      "This line is changed.",
      "And some new lines will be added.",
      "Here is a new line.",
      "Another new line.",
      "",
      "## Section 1",
      "Modified content in section 1",
      "Added line in section 1",
      "",
      "## Section 2",
      "Content in section 2",
      "New subsection added",
    ].join("\n");

    await withTempFiles(
      originalContent,
      modifiedContent,
      async (originalFile, modifiedFile) => {
        // Execute actual diff command
        const diffProcess = Bun.spawn([
          "diff",
          "-u",
          originalFile,
          modifiedFile,
        ]);
        const diffOutput = await new Response(diffProcess.stdout).text();

        // Create patch using our implementation
        const ourPatch = createPatch(originalContent, modifiedContent);

        // Convert diff output to our patch format
        const diffPatch = createPatchFromDiff(diffOutput);

        // Compare patch application results
        const ourResult = applyPatch(originalContent, ourPatch);
        const diffResult = applyPatch(originalContent, diffPatch);

        expect(ourResult).toBe(modifiedContent);
        expect(diffResult).toBe(modifiedContent);
      },
    );
  });

  test("should handle complex document structure changes", async () => {
    const originalContent = [
      "# Project Setup Guide",
      "",
      "## Installation",
      "",
      "```bash",
      "npm install",
      "npm run build",
      "```",
      "",
      "## Configuration",
      "",
      "### Database Configuration",
      "Please configure the database connection settings:",
      "",
      "```javascript",
      "module.exports = {",
      "  host: 'localhost',",
      "  port: 5432,",
      "  database: 'myapp',",
      "  username: 'admin'",
      "}",
      "```",
      "",
      "### Application Configuration",
      "",
      "Set the environment variables:",
      "",
      "```bash",
      "PORT=3000",
      "NODE_ENV=development",
      "```",
      "",
      "## Usage",
      "",
      "Start the application:",
      "",
      "```bash",
      "npm start",
      "```",
      "",
      "Run tests:",
      "",
      "```bash",
      "npm test",
      "```",
    ].join("\n");

    const modifiedContent = [
      "# Project Setup Guide v2.0",
      "",
      "## Prerequisites",
      "",
      "- Node.js 18.0 or higher",
      "- PostgreSQL 15.0 or higher",
      "",
      "## Installation",
      "",
      "Install packages and initialize:",
      "",
      "```bash",
      "npm install",
      "npm run setup # New setup script",
      "npm run build",
      "```",
      "",
      "## Configuration",
      "",
      "### Database Configuration",
      "Configure database connection settings in the `.env` file:",
      "",
      "```javascript",
      "module.exports = {",
      "  host: process.env.DB_HOST || 'localhost',",
      "  port: parseInt(process.env.DB_PORT || '5432'),",
      "  database: process.env.DB_NAME || 'myapp',",
      "  username: process.env.DB_USER || 'admin',",
      "  password: process.env.DB_PASS,",
      "  ssl: process.env.DB_SSL === 'true'",
      "}",
      "```",
      "",
      "### Application Configuration",
      "",
      "Example environment variables:",
      "",
      "```bash",
      "PORT=3000",
      "NODE_ENV=development",
      "LOG_LEVEL=debug",
      "ENABLE_METRICS=true",
      "```",
      "",
      "## Usage",
      "",
      "Start in development mode:",
      "",
      "```bash",
      "npm run dev # Hot reload enabled",
      "```",
      "",
      "Start in production mode:",
      "",
      "```bash",
      "npm run build",
      "npm start",
      "```",
      "",
      "Run tests:",
      "",
      "```bash",
      "npm run test:unit    # Unit tests",
      "npm run test:e2e     # E2E tests",
      "npm run test:coverage # Coverage report",
      "```",
      "",
      "## Troubleshooting",
      "",
      "For common issues and solutions, please refer to the [FAQ page](./docs/FAQ.md).",
    ].join("\n");

    await withTempFiles(
      originalContent,
      modifiedContent,
      async (originalFile, modifiedFile) => {
        // Execute actual diff command
        const diffProcess = Bun.spawn([
          "diff",
          "-u",
          originalFile,
          modifiedFile,
        ]);
        const diffOutput = await new Response(diffProcess.stdout).text();

        // Create patch using our implementation
        const ourPatch = createPatch(originalContent, modifiedContent);

        // Convert diff output to our patch format
        const diffPatch = createPatchFromDiff(diffOutput);

        // Compare patch application results
        const ourResult = applyPatch(originalContent, ourPatch);
        const diffResult = applyPatch(originalContent, diffPatch);

        expect(ourResult).toBe(modifiedContent);
        expect(diffResult).toBe(modifiedContent);
      },
    );
  });
});
