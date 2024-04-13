import { describe, it, expect } from "bun:test";
import {
  extractDefinitionSymbols,
  extractReferenceSymbols,
} from "./extract-symbols";

describe("extract-symbols.ts Tests", () => {
  describe("extractDefinitionSymbols", () => {
    it("should extract symbols from definitions correctly", () => {
      const text = `
        module myModule {
        function myFunction()
        func myFunc()
        def myDef()
        class MyClass extends AnotherClass {
        struct MyStruct {}
        type MyType = {}
        export type MyExportType = {}
        interface MyInterface
      `;
      const expectedSymbols = [
        "myModule",
        "myFunction",
        "myFunc",
        "myDef",
        "MyClass",
        "MyStruct",
        "MyType",
        "MyExportType",
        "MyInterface",
      ];
      const symbols = extractDefinitionSymbols(text);
      expect(symbols).toEqual(expectedSymbols);
    });
  });

  describe("extractReferenceSymbols", () => {
    it("should extract symbols from references correctly", () => {
      const text = `
        import myImport
        import { myImport1, myImport2 } from "myModule"
        require myRequire
        use myUse
      `.replace(/^\s+/gm, "");
      const expectedSymbols = [
        "myImport",
        "myImport1",
        "myImport2",
        "myRequire",
        "myUse",
      ];
      const symbols = extractReferenceSymbols(text);
      expect(symbols).toEqual(expectedSymbols);
    });
  });
});
