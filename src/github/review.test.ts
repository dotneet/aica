import { generateReview } from "./review";
import { defaultConfig } from "@/config";
import { deepAssign } from "@/utility/deep-assign";
import { describe, it, expect } from "bun:test";

// Mock diff string
const mockDiffString =
  "diff --git a/file1.js b/file1.js\nindex 83db48f..bf3a6c4 100644\n--- a/file1.js\n+++ b/file1.js\n@@ -1,4 +1,4 @@\n-console.log('Hello World');\n+console.log('Hello, World!');";

// Test cases
describe("generateReview", () => {
  it("should return a GitHub style table with issues", async () => {
    const config = deepAssign(defaultConfig, {
      llm: {
        provider: "stub",
        stub: { response: '{"issues": [{"description": "Mock issue"}]}' },
      },
    });
    const result = await generateReview(config, mockDiffString);
    expect(result).toContain("Mock issue");
  });

  it('should return "No bugs found." when there are no issues', async () => {
    const config = deepAssign(defaultConfig, {
      llm: {
        provider: "stub",
        stub: { response: '{"issues": []}' },
      },
    });
    const result = await generateReview(config, mockDiffString);
    expect(result).toBe("No bugs found.");
  });
});
