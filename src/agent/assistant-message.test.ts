import { describe, expect, test } from "bun:test";
import {
  type ActionBlock,
  type PlainMessageBlock,
  parseAssistantMessage,
} from "./assistant-message";

describe("parseAssistantMessage", () => {
  test("should parse plain text message", () => {
    const message = "Hello, this is a plain text message";
    const result = parseAssistantMessage(message);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("plain");
    expect((result[0] as PlainMessageBlock).content).toBe(message);
  });

  test("should parse message with single tool use", () => {
    const message = `I will read the file.
<read_file>
<path>test.txt</path>
</read_file>
Done reading.`;

    const result = parseAssistantMessage(message);
    expect(result).toHaveLength(3);
    expect(result[0].type).toBe("plain");
    expect((result[0] as PlainMessageBlock).content).toBe(
      "I will read the file.\n",
    );

    expect(result[1].type).toBe("action");
    expect((result[1] as ActionBlock).action).toEqual({
      toolId: "read_file",
      params: {
        path: "test.txt",
      },
    });

    expect(result[2].type).toBe("plain");
    expect((result[2] as PlainMessageBlock).content).toBe("\nDone reading.");
  });

  test("should parse message with multiple tool uses", () => {
    const message = `First step:
<list_files>
<directory>src</directory>
</list_files>
Next step:
<read_file>
<path>src/test.txt</path>
</read_file>
All done.`;

    const result = parseAssistantMessage(message);
    expect(result).toHaveLength(5);

    expect(result[0].type).toBe("plain");
    expect((result[0] as PlainMessageBlock).content).toBe("First step:\n");

    expect(result[1].type).toBe("action");
    expect((result[1] as ActionBlock).action).toEqual({
      toolId: "list_files",
      params: {
        directory: "src",
      },
    });

    expect(result[2].type).toBe("plain");
    expect((result[2] as PlainMessageBlock).content).toBe("\nNext step:\n");

    expect(result[3].type).toBe("action");
    expect((result[3] as ActionBlock).action).toEqual({
      toolId: "read_file",
      params: {
        path: "src/test.txt",
      },
    });

    expect(result[4].type).toBe("plain");
    expect((result[4] as PlainMessageBlock).content).toBe("\nAll done.");
  });

  test("should handle empty message", () => {
    const result = parseAssistantMessage("");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("plain");
    expect((result[0] as PlainMessageBlock).content).toBe("");
  });

  test("should handle message with invalid tool format", () => {
    const message = `Some text
<invalid_tool>
<param>value</param>
</invalid_tool>
More text`;

    const result = parseAssistantMessage(message);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("plain");
    expect((result[0] as PlainMessageBlock).content).toBe(message);
  });
});
