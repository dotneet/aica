export function extractDefinitionSymbols(text: string) {
  // extract lines including 'module', 'function', 'func', 'def', 'class', 'struct', 'type', 'interface'
  const keywords = [
    "module",
    "function",
    "func",
    "def",
    "class",
    "struct",
    "type",
    "interface",
  ];
  const keywordLines = text
    .split("\n")
    .filter((line) => keywords.some((keyword) => line.includes(`${keyword} `)));

  const symbols = keywordLines.map((line) => {
    return line
      .replace(
        /(export\s+)?(module|function|func|def|class|struct|type|interface)\s*([a-zA-Z0-9_]+).*/,
        "$3",
      )
      .trim();
  });

  return symbols;
}

export function extractReferenceSymbols(text: string) {
  const keywords = ["import", "require", "use"];
  const keywordLines = text
    .split("\n")
    .filter((line) => keywords.some((keyword) => line.includes(`${keyword} `)));
  const symbols: string[] = [];
  for (const line of keywordLines) {
    if (line.includes("import")) {
      const words = line
        .replace(/import\s+\{?\s*(\w+\s*(,\s*\w+)*)?\s*\}?/, "$1")
        .replace(/from .*/, "")
        .split(",")
        .map((word) => word.trim());
      symbols.push(...words);
      continue;
    }
    const symbol = line
      .replace(/(import|require|use) (\w+)/, "$2")
      .replace(/({|}|=|;|"|'|,)/g, "")
      .trim();
    symbols.push(symbol);
  }

  return symbols;
}
