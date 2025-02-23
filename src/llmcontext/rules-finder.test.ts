import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { RulesFinder } from "./rules-finder";
import { RulesConfig } from "../config";

describe("RulesFinder", () => {
  const testDir = ".test-rules-finder";
  const rulesDir = path.join(testDir, ".cursor/rules");

  const testConfig: RulesConfig = {
    findCursorRules: true,
    files: ["fixed-rule.mdc"],
  };

  const createTestFile = async (filePath: string, content: string) => {
    const fullPath = path.join(testDir, filePath);
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.promises.writeFile(fullPath, content);
  };

  beforeEach(async () => {
    await fs.promises.mkdir(testDir, { recursive: true });
    await fs.promises.mkdir(rulesDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.promises.rm(testDir, { recursive: true, force: true });
  });

  test("findFixedContext should read fixed rules", async () => {
    const fixedRuleContent = `---
description: Fixed rule
globs: *.ts
---
This is a fixed rule content`;

    await createTestFile("fixed-rule.mdc", fixedRuleContent);

    const finder = new RulesFinder(testDir, testConfig);
    const rules = await finder.findFixedContext();

    expect(rules).toHaveLength(1);
    expect(rules[0]).toBe(fixedRuleContent);
  });

  test("findRulesForFiles should read rules from .cursor/rules", async () => {
    const ruleContent = `---
description: Test rule
globs: *.ts
---
This is a test rule content`;

    await createTestFile(".cursor/rules/test.mdc", ruleContent);

    const finder = new RulesFinder(testDir, testConfig);
    const rules = await finder.findRulesForFiles(["test.ts"]);

    expect(rules).toHaveLength(1);
    expect(rules[0]).toEqual({
      description: "Test rule",
      globs: "*.ts",
      content: "This is a test rule content",
    });
  });

  test("findAllRules should combine fixed and file rules", async () => {
    const fixedRuleContent = `---
description: Fixed rule
globs: *.ts
---
This is a fixed rule content`;

    const fileRuleContent = `---
description: File rule
globs: *.ts
---
This is a file rule content`;

    await createTestFile("fixed-rule.mdc", fixedRuleContent);
    await createTestFile(".cursor/rules/test.mdc", fileRuleContent);

    const finder = new RulesFinder(testDir, testConfig);
    const result = await finder.findAllRules(["test.ts"]);

    expect(result.fixedContexts).toHaveLength(1);
    expect(result.fileRules).toHaveLength(1);
    expect(result.fixedContexts[0]).toBe(fixedRuleContent);
    expect(result.fileRules[0].description).toBe("File rule");
  });

  test("findRulesForFiles should return empty array when findCursorRules is false", async () => {
    const finder = new RulesFinder(testDir, {
      ...testConfig,
      findCursorRules: false,
    });
    const rules = await finder.findRulesForFiles(["test.ts"]);
    expect(rules).toHaveLength(0);
  });

  test("findRulesForFiles should handle invalid MDC files", async () => {
    const invalidContent = "Invalid content without header";
    await createTestFile(".cursor/rules/invalid.mdc", invalidContent);

    const finder = new RulesFinder(testDir, testConfig);
    const rules = await finder.findRulesForFiles(["test.ts"]);
    expect(rules).toHaveLength(0);
  });

  test("findFixedContext should handle non-existent files", async () => {
    const finder = new RulesFinder(testDir, {
      findCursorRules: true,
      files: ["non-existent.mdc"],
    });
    const rules = await finder.findFixedContext();
    expect(rules).toHaveLength(0);
  });
});
