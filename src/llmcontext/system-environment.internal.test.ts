import { describe, expect, test } from "bun:test";
import {
  composeIgnorePatterns,
  matchGitignorePattern,
  matchesAnyIgnorePattern,
} from "./system-environment";

describe("system-environment internal tests", () => {
  describe("matchGitignorePattern()", () => {
    test("should match simple pattern without slash", () => {
      expect(matchGitignorePattern("foo.txt", "foo.txt")).toBe(true);
      expect(matchGitignorePattern("foo.txt", "bar/foo.txt")).toBe(true);
      expect(matchGitignorePattern("*.txt", "bar/foo.txt")).toBe(true);
    });

    test("should handle wildcards and negative patterns", () => {
      // Test matchGitignorePattern function in isolation
      // For patterns like *.log
      expect(matchGitignorePattern("*.log", "error.log")).toBe(true);
      expect(matchGitignorePattern("!error.log", "error.log")).toBe(false);
      // Note: The '!' is actually handled by matchesAnyIgnorePattern's internal logic
      // but we verify the behavior here anyway
    });
  });

  describe("composeIgnorePatterns()", () => {
    test("should combine defaultIgnorePatterns and .gitignore patterns", () => {
      // Using dummy defaultIgnorePatterns and test directory (pseudo)
      // Since this actually reads from the filesystem, we'll keep this test shallow
      const defaultPatterns = ["node_modules", "dist"];
      const combined = composeIgnorePatterns("/dummy/path", defaultPatterns);

      // Check if the return value is an array of patterns
      expect(Array.isArray(combined)).toBe(true);
      // Roughly verify that defaultIgnorePatterns are included
      expect(combined.find((p) => p.pattern === "node_modules")).toBeTruthy();
      expect(combined.find((p) => p.pattern === "dist")).toBeTruthy();
    });
  });

  describe("matchesAnyIgnorePattern()", () => {
    test("should ignore matching patterns", () => {
      const combined = [
        { pattern: "node_modules", isNegative: false },
        { pattern: "temp/", isNegative: false },
        { pattern: "src/temp/", isNegative: true }, // Negative pattern to "revive" the path
      ];
      // src/temp/hello.txt could be ignored by "temp/" or "node_modules"
      // but "src/temp/" appears later as a negative pattern -> revived and not ignored
      expect(matchesAnyIgnorePattern(combined, "src/temp/hello.txt")).toBe(
        false,
      );

      // node_modules/package.json is normally ignored
      expect(
        matchesAnyIgnorePattern(combined, "node_modules/package.json"),
      ).toBe(true);

      // foo.js doesn't match any pattern -> not ignored
      expect(matchesAnyIgnorePattern(combined, "foo.js")).toBe(false);
    });

    test("should handle wildcard patterns like *.txt", () => {
      const patterns = [
        { pattern: "*.txt", isNegative: false },
        { pattern: "secret.txt", isNegative: true }, // secret.txt is revived
      ];
      expect(matchesAnyIgnorePattern(patterns, "test.txt")).toBe(true);
      expect(matchesAnyIgnorePattern(patterns, "secret.txt")).toBe(false);
      expect(matchesAnyIgnorePattern(patterns, "image.png")).toBe(false);
    });
  });
});
