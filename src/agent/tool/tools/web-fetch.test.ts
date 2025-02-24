import { expect, describe, it } from "bun:test";
import { isUnsafeUrl, getMarkdownFromPage } from "./web-fetch";

describe("isUnsafeUrl", () => {
  it("should return true for localhost", () => {
    expect(isUnsafeUrl("http://localhost")).toBe(true);
  });

  it("should return true for private IP addresses", () => {
    expect(isUnsafeUrl("http://192.168.0.1")).toBe(true);
  });

  it("should return true for file protocol", () => {
    expect(isUnsafeUrl("file:///path/to/file")).toBe(true);
  });

  it("should return false for safe URLs", () => {
    expect(isUnsafeUrl("http://www.example.com")).toBe(false);
  });
});

describe("getMarkdownFromPage", () => {
  it("should return markdown from a valid URL", async () => {
    const url = "https://www.example.com";
    const markdown = await getMarkdownFromPage(url);
    expect(markdown).not.toBeNull();
  });

  it("should throw an error for an invalid URL", async () => {
    const url = "invalid-url";
    await expect(getMarkdownFromPage(url)).rejects.toThrow();
  });

  it("should throw an error for an unsafe URL", async () => {
    const url = "http://localhost";
    await expect(getMarkdownFromPage(url)).rejects.toThrow();
  });

  it("should convert HTML to Markdown", async () => {
    const url = "https://www.example.com";
    const markdown = await getMarkdownFromPage(url);
    expect(markdown).toContain(
      "This domain is for use in illustrative examples in documents",
    );
  });
});
