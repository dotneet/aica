import { describe, expect, test } from "bun:test";
import { extractJsonFromText } from "./llm";

describe("extractJsonFrom", () => {
  test("extracts JSON from plain markdown text", () => {
    const markdown = `Here is some JSON: {"name": "test", "value": 123}`;
    const expected = `{"name": "test", "value": 123}`;
    expect(extractJsonFromText(markdown)).toBe(expected);
  });

  test("extracts JSON from code block", () => {
    const markdown = '```json\n{"name": "test", "value": 123}\n```';
    const expected = `{"name": "test", "value": 123}`;
    expect(extractJsonFromText(markdown)).toBe(expected);
  });

  test("extracts JSON with explanation before it", () => {
    const markdown =
      'This is a configuration file:\n{"config": true, "debug": false}';
    const expected = `{"config": true, "debug": false}`;
    expect(extractJsonFromText(markdown)).toBe(expected);
  });

  test("returns null when no JSON is found", () => {
    const markdown = "This is just a plain text without any JSON";
    expect(extractJsonFromText(markdown)).toBeNull();
  });

  test("returns first JSON when multiple JSONs exist", () => {
    const markdown = `
            First JSON: {"id": 1, "name": "first"}
            Second JSON: {"id": 2, "name": "second"}
        `;
    const expected = `{"id": 1, "name": "first"}`;
    expect(extractJsonFromText(markdown)).toBe(expected);
  });

  test("handles nested JSON objects", () => {
    const markdown =
      'Complex JSON: {"user": {"name": "test", "settings": {"theme": "dark"}}}';
    const expected = `{"user": {"name": "test", "settings": {"theme": "dark"}}}`;
    expect(extractJsonFromText(markdown)).toBe(expected);
  });
});
