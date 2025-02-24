import { describe, expect, it } from "bun:test";
import { type Config, defaultConfig } from "@/config";
import { generateSummary } from "./summary";

// テストケース
describe("generateSummary", () => {
  it("should return a GitHub style table with changes", async () => {
    const config: Config = {
      ...defaultConfig,
      llm: {
        ...defaultConfig.llm,
        provider: "stub",
        stub: {
          response:
            '{"changes":[{"category": "refactor", "description": "Refactor the code to improve readability and maintainability."},{"category": "bugfix", "description": "resolve the usage of undeclared variable \'i\'."}]}',
        },
      },
    };
    const diffString =
      "diff --git a/file1.js b/file1.js\nindex 83db48f..bf3a6c4 100644\n--- a/file1.js\n+++ b/file1.js\n@@ -1,4 +1,4 @@\n-console.log('Hello World');\n+console.log('Hello, World!');";
    const result = await generateSummary(config, diffString);
    expect(result).toContain(
      "Refactor the code to improve readability and maintainability.",
    );
    expect(result).toContain("resolve the usage of undeclared variable 'i'.");
  });
});
