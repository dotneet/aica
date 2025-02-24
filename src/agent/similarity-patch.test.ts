import { describe, expect, test } from "bun:test";
import {
  applyPatchWithSimilarity,
  computeSimilarity,
  extractHunks,
  findMostSimilarBlockIndex,
  joinLinesIntoText,
  parseUnifiedDiff,
  splitTextIntoLines,
} from "./similarity-patch";

/**
 * similarity-patch.ts の関数群をテストします。
 */
describe("similarity-patch3 テスト", () => {
  test("splitTextIntoLines: 改行文字を統一して行分割できる", () => {
    const inputText = "こんにちは\r\n世界\nFoo\r\nBar";
    const lines = splitTextIntoLines(inputText);
    expect(lines).toEqual(["こんにちは", "世界", "Foo", "Bar"]);
  });

  test("joinLinesIntoText: 行配列から正しくテキストを復元できる", () => {
    const lines = ["こんにちは", "世界", "Foo", "Bar"];
    const joined = joinLinesIntoText(lines);
    expect(joined).toBe("こんにちは\n世界\nFoo\nBar");
  });

  test("parseUnifiedDiff: @@ 行を含む文字列を正しくパースして Hunk を抽出できる", () => {
    const diffText = [
      "@@ 1,5 2,5 @@",
      " foo",
      "-bar",
      "+baz",
      "@@ 10,3 12,2 @@",
      "-hoge",
      "+piyo",
      " unchanged",
    ].join("\n");

    const unifiedDiff = parseUnifiedDiff(diffText);
    expect(unifiedDiff.hunks.length).toBe(2);

    // 1つ目のHunk
    expect(unifiedDiff.hunks[0].header).toBe("@@ 1,5 2,5 @@");
    expect(unifiedDiff.hunks[0].lines).toEqual([" foo", "-bar", "+baz"]);

    // 2つ目のHunk
    expect(unifiedDiff.hunks[1].header).toBe("@@ 10,3 12,2 @@");
    expect(unifiedDiff.hunks[1].lines).toEqual([
      "-hoge",
      "+piyo",
      " unchanged",
    ]);
  });

  test("extractHunks: @@ の行を境界に Hunk に分割できる", () => {
    const fakeDiffLines = [
      "@@ 1,5 2,5 @@",
      " foo",
      "-bar",
      "+baz",
      "@@ 10,3 12,2 @@",
      "-hoge",
      "+piyo",
      " unchanged",
    ];
    const hunks = extractHunks(fakeDiffLines);
    expect(hunks.length).toBe(2);
    expect(hunks[0].header).toBe("@@ 1,5 2,5 @@");
    expect(hunks[0].lines).toEqual([" foo", "-bar", "+baz"]);
  });

  test("computeSimilarity: 行配列どうしの一致数をスコアとして返す", () => {
    const blockA = ["ABC", "DEF", "GHI"];
    const blockB = ["ABC", "XYZ", "GHI"];
    const score = computeSimilarity(blockA, blockB);
    // 2行目が異なるので一致は2行分
    expect(score).toBe(2);
  });

  test("findMostSimilarBlockIndex: 最も一致度の高い箇所の先頭インデックスが返される", () => {
    const original = ["AAA", "BBB", "CCC", "DDD", "EEE"];
    const target = ["BBB", "CCC"];
    const index = findMostSimilarBlockIndex(original, target);
    // original[1..2] = ["BBB", "CCC"] が最も一致する
    expect(index).toBe(1);
  });

  describe("applyPatchWithSimilarity: パッチ全体をテキストに適用する", () => {
    test("基本的な削除・追加が反映される", () => {
      const originalText = [
        "function greet() {",
        "  console.log('Hello');",
        "}",
        "export {}",
      ].join("\n");

      const diffText = [
        "@@ 1,3 1,3 @@",
        " function greet() {",
        "-  console.log('Hello');",
        "+  console.log('Hi');",
        " }",
      ].join("\n");

      const result = applyPatchWithSimilarity(originalText, diffText);
      const lines = result.split("\n");
      expect(lines[1]).toBe("  console.log('Hi');");
      expect(lines).toHaveLength(4);
    });

    test("複数行の削除と追加が同時に適用される", () => {
      const originalText = [
        "const arr = [1, 2, 3];",
        "function sum(arr) {",
        "  let total = 0;",
        "  for (let i of arr) {",
        "    total += i;",
        "  }",
        "  return total;",
        "}",
      ].join("\n");

      const diffText = [
        "@@ 1,8 1,7 @@",
        " const arr = [1, 2, 3];",
        " function sum(arr) {",
        "-  let total = 0;",
        "-  for (let i of arr) {",
        "-    total += i;",
        "-  }",
        "-  return total;",
        "+  return arr.reduce((acc, x) => acc + x, 0);",
        " }",
      ].join("\n");

      const patched = applyPatchWithSimilarity(originalText, diffText);
      const lines = patched.split("\n");
      // for, let total ... などの行が削除され、新しい return 行に置き換えられている
      expect(patched).not.toContain("for (let i of arr)");
      expect(patched).not.toContain("total += i;");
      expect(patched).toContain("return arr.reduce((acc, x) => acc + x, 0);");
      expect(lines).toHaveLength(4); // "const arr" + "function sum(arr) {" + "  return arr.reduce(...) }"
    });

    test("コンテキストがある場合にも削除位置を適切に推定してパッチ適用", () => {
      const originalText = [
        "Line1 context before",
        "Line2 to remove",
        "Line3 to remove",
        "Line4 context after",
        "Line5 more context",
      ].join("\n");

      // コンテキスト行として "Line1 context before" や "Line4 context after" が含まれる
      // 削除対象は "Line2 to remove" と "Line3 to remove"
      const diffText = [
        "@@ -1,5 +1,4 @@",
        " Line1 context before",
        "-Line2 to remove",
        "-Line3 to remove",
        " Line4 context after",
      ].join("\n");

      const patched = applyPatchWithSimilarity(originalText, diffText);
      const lines = patched.split("\n");
      expect(lines).toEqual([
        "Line1 context before",
        "Line4 context after",
        "Line5 more context",
      ]);
    });

    test("大規模なコードブロックの変更に対応できる", () => {
      const originalText = [
        "import React from 'react';",
        "import { useState, useEffect } from 'react';",
        "",
        "interface TodoItem {",
        "  id: number;",
        "  text: string;",
        "  completed: boolean;",
        "}",
        "",
        "const TodoList: React.FC = () => {",
        "  const [todos, setTodos] = useState<TodoItem[]>([]);",
        "  const [input, setInput] = useState('');",
        "",
        "  const addTodo = () => {",
        "    if (input.trim() === '') return;",
        "    const newTodo: TodoItem = {",
        "      id: Date.now(),",
        "      text: input,",
        "      completed: false",
        "    };",
        "    setTodos([...todos, newTodo]);",
        "    setInput('');",
        "  };",
        "",
        "  const toggleTodo = (id: number) => {",
        "    setTodos(todos.map(todo =>",
        "      todo.id === id ? { ...todo, completed: !todo.completed } : todo",
        "    ));",
        "  };",
        "",
        "  return (",
        "    <div>",
        "      <h1>Todo List</h1>",
        "      <input",
        "        type='text'",
        "        value={input}",
        "        onChange={(e) => setInput(e.target.value)}",
        "      />",
        "      <button onClick={addTodo}>Add Todo</button>",
        "      <ul>",
        "        {todos.map(todo => (",
        "          <li key={todo.id}>",
        "            <input",
        "              type='checkbox'",
        "              checked={todo.completed}",
        "              onChange={() => toggleTodo(todo.id)}",
        "            />",
        "            {todo.text}",
        "          </li>",
        "        ))}",
        "      </ul>",
        "    </div>",
        "  );",
        "};",
        "",
        "export default TodoList;",
      ].join("\n");

      const diffText = [
        "@@ -1,49 +1,62 @@",
        " import React from 'react';",
        "-import { useState, useEffect } from 'react';",
        "+import { useState } from 'react';",
        "+import styled from 'styled-components';",
        " ",
        " interface TodoItem {",
        "   id: number;",
        "   text: string;",
        "   completed: boolean;",
        "+  priority: 'low' | 'medium' | 'high';",
        " }",
        " ",
        "+const Container = styled.div`",
        "+  max-width: 600px;",
        "+  margin: 0 auto;",
        "+  padding: 20px;",
        "+`;",
        "+",
        "+const TodoItemStyled = styled.li<{ completed: boolean; priority: string }>`",
        "+  text-decoration: ${props => props.completed ? 'line-through' : 'none'};",
        "+  color: ${props => props.completed ? '#888' : '#000'};",
        "+  background-color: ${props => {",
        "+    switch (props.priority) {",
        "+      case 'high': return '#ffebee';",
        "+      case 'medium': return '#fff3e0';",
        "+      default: return '#f1f8e9';",
        "+    }",
        "+  }};",
        "+`;",
        "+",
        " const TodoList: React.FC = () => {",
        "   const [todos, setTodos] = useState<TodoItem[]>([]);",
        "   const [input, setInput] = useState('');",
        "+  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('low');",
        " ",
        "   const addTodo = () => {",
        "     if (input.trim() === '') return;",
        "     const newTodo: TodoItem = {",
        "       id: Date.now(),",
        "       text: input,",
        "-      completed: false",
        "+      completed: false,",
        "+      priority: priority",
        "     };",
        "     setTodos([...todos, newTodo]);",
        "     setInput('');",
        "   };",
        " ",
        "   const toggleTodo = (id: number) => {",
        "     setTodos(todos.map(todo =>",
        "       todo.id === id ? { ...todo, completed: !todo.completed } : todo",
        "     ));",
        "   };",
        " ",
        "   return (",
        "-    <div>",
        "+    <Container>",
        "       <h1>Todo List</h1>",
        "       <input",
        "         type='text'",
        "         value={input}",
        "         onChange={(e) => setInput(e.target.value)}",
        "       />",
        "+      <select value={priority} onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}>",
        "+        <option value='low'>Low</option>",
        "+        <option value='medium'>Medium</option>",
        "+        <option value='high'>High</option>",
        "+      </select>",
        "       <button onClick={addTodo}>Add Todo</button>",
        "       <ul>",
        "         {todos.map(todo => (",
        "-          <li key={todo.id}>",
        "+          <TodoItemStyled key={todo.id} completed={todo.completed} priority={todo.priority}>",
        "             <input",
        "               type='checkbox'",
        "               checked={todo.completed}",
        "               onChange={() => toggleTodo(todo.id)}",
        "             />",
        "-            {todo.text}",
        "+            {todo.text} - {todo.priority}",
        "-          </li>",
        "+          </TodoItemStyled>",
        "         ))}",
        "       </ul>",
        "-    </div>",
        "+    </Container>",
        "   );",
        " };",
        " ",
        " export default TodoList;",
      ].join("\n");

      const patched = applyPatchWithSimilarity(originalText, diffText);
      const lines = patched.split("\n");

      // 重要な変更が正しく適用されているか確認
      expect(lines.join("\n")).toContain(
        "import styled from 'styled-components';",
      );
      expect(lines.join("\n")).toContain(
        "priority: 'low' | 'medium' | 'high';",
      );
      expect(lines.join("\n")).toContain("const Container = styled.div`");
      expect(lines.join("\n")).toContain(
        "const TodoItemStyled = styled.li<{ completed: boolean; priority: string }>`",
      );
      expect(lines.join("\n")).toContain(
        "const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('low');",
      );
      expect(lines.join("\n")).not.toContain(
        "import { useState, useEffect } from 'react';",
      );
      expect(lines.join("\n")).toContain("import { useState } from 'react';");
    });

    test("空のファイルに対するパッチ適用が正しく動作する", () => {
      const originalText = "";
      const diffText = [
        "@@ -0,0 +1,3 @@",
        "+// 新しく追加されるファイル",
        "+const VERSION = '1.0.0';",
        "+export default VERSION;",
      ].join("\n");

      const patched = applyPatchWithSimilarity(originalText, diffText);
      const lines = patched.split("\n");
      expect(lines).toEqual([
        "", // 空のファイルの場合、最初の行は空行になる
        "// 新しく追加されるファイル",
        "const VERSION = '1.0.0';",
        "export default VERSION;",
      ]);
    });

    test("非常に長い行を含むファイルのパッチ適用", () => {
      const longString = "x".repeat(10000);
      const originalText = ["// 短い行", longString, "// 別の短い行"].join(
        "\n",
      );

      const diffText = [
        "@@ -1,3 +1,4 @@",
        " // 短い行",
        ` ${longString}`,
        "+// 新しく追加された行",
        " // 別の短い行",
      ].join("\n");

      const patched = applyPatchWithSimilarity(originalText, diffText);
      const lines = patched.split("\n");
      expect(lines).toEqual([
        "// 短い行",
        longString,
        "// 新しく追加された行",
        "// 別の短い行",
      ]);
    });

    test("特殊文字を含むコードのパッチ適用", () => {
      const originalText = [
        "function test() {",
        "  const emoji = '🎉';",
        "  const japanese = 'こんにちは';",
        "  const special = '\\n\\t\\r';",
        "  return `${emoji}${japanese}${special}`;",
        "}",
      ].join("\n");

      const diffText = [
        "@@ -1,6 +1,8 @@",
        " function test() {",
        "   const emoji = '🎉';",
        "+  const newEmoji = '🚀';",
        "   const japanese = 'こんにちは';",
        "+  const moreJapanese = 'さようなら';",
        "   const special = '\\n\\t\\r';",
        "-  return `${emoji}${japanese}${special}`;",
        "+  return `${emoji}${newEmoji}${japanese}${moreJapanese}${special}`;",
        " }",
      ].join("\n");

      const patched = applyPatchWithSimilarity(originalText, diffText);
      const lines = patched.split("\n");
      expect(lines).toEqual([
        "function test() {",
        "  const emoji = '🎉';",
        "  const newEmoji = '🚀';",
        "  const japanese = 'こんにちは';",
        "  const moreJapanese = 'さようなら';",
        "  const special = '\\n\\t\\r';",
        "  return `${emoji}${newEmoji}${japanese}${moreJapanese}${special}`;",
        "}",
      ]);
    });

    test("複数のハンクが重なる場合のパッチ適用", () => {
      const originalText = [
        "function calculate(a: number, b: number) {",
        "  // 計算処理",
        "  const sum = a + b;",
        "  const diff = a - b;",
        "  const product = a * b;",
        "  const quotient = a / b;",
        "  ",
        "  return {",
        "    sum,",
        "    diff,",
        "    product,",
        "    quotient,",
        "  };",
        "}",
      ].join("\n");

      const diffText = [
        "@@ -1,7 +1,9 @@",
        " function calculate(a: number, b: number) {",
        "   // 計算処理",
        "+  if (b === 0) throw new Error('Division by zero');",
        "   const sum = a + b;",
        "   const diff = a - b;",
        "+  const abs = Math.abs(diff);",
        "   const product = a * b;",
        "@@ -8,7 +10,8 @@",
        "   return {",
        "     sum,",
        "     diff,",
        "+    abs,",
        "     product,",
        "-    quotient,",
        "+    quotient: b === 0 ? Infinity : quotient,",
        "   };",
        " }",
      ].join("\n");

      const patched = applyPatchWithSimilarity(originalText, diffText);
      const lines = patched.split("\n");
      expect(lines).toEqual([
        "function calculate(a: number, b: number) {",
        "  // 計算処理",
        "  if (b === 0) throw new Error('Division by zero');",
        "  const sum = a + b;",
        "  const diff = a - b;",
        "  const abs = Math.abs(diff);",
        "  const product = a * b;",
        "  const quotient = a / b;",
        "  ",
        "  return {",
        "    sum,",
        "    diff,",
        "    abs,",
        "    product,",
        "    quotient: b === 0 ? Infinity : quotient,",
        "  };",
        "}",
      ]);
    });

    test("インデントが混在するコードのパッチ適用", () => {
      const originalText = [
        "function processData() {",
        "\tconst data = {",
        "    name: 'test',",
        "\t\tvalue: 123,",
        "  };",
        "",
        "\treturn data;",
        "}",
      ].join("\n");

      const diffText = [
        "@@ -1,8 +1,9 @@",
        " function processData() {",
        " \tconst data = {",
        "-    name: 'test',",
        "+    name: 'updated',",
        " \t\tvalue: 123,",
        "+\t\ttype: 'example',",
        "   };",
        " ",
        " \treturn data;",
        " }",
      ].join("\n");

      const patched = applyPatchWithSimilarity(originalText, diffText);
      const lines = patched.split("\n");

      // パッチ適用後の期待される結果を修正
      const expected = [
        "function processData() {",
        "\tconst data = {",
        "    name: 'updated',",
        "\t\tvalue: 123,",
        "\t\ttype: 'example',",
        "  };",
        "",
        "\treturn data;",
        "}",
      ];

      // 各行を個別に比較して、インデントの違いを確認
      lines.forEach((line, i) => {
        expect(line).toBe(expected[i]);
      });
    });
  });
});
