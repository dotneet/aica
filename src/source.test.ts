import { Source } from "./source";
import { describe, it, expect } from "bun:test";

describe("appendLineNumbers", () => {
  it("should return code with correct line numbers", () => {
    const code = Source.fromText(
      "dummy",
      `function test() {\n  console.log("Hello, world!");\n}`
    );
    const expected = `1: function test() {\n2:   console.log("Hello, world!");\n3: }`;
    expect(code.contentWithLineNumbers).toEqual(expected);
  });

  it("should return an empty string for empty code", () => {
    const code = Source.fromText("dummy", "");
    const expected = "";
    expect(code.contentWithLineNumbers).toBe(expected);
  });

  it("should correctly number code that is only one line", () => {
    const code = Source.fromText("dummy", `console.log("Only one line");`);
    const expected = `1: console.log("Only one line");`;
    expect(code.contentWithLineNumbers).toEqual(expected);
  });
});
