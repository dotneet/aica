import { ToolId, Action } from "./tool/mod";

export type MessageBlock = PlainMessageBlock | ActionBlock;

export interface PlainMessageBlock {
  type: "plain";
  content: string;
}

export interface ActionBlock {
  type: "action";
  action: Action;
}

const validToolIds: ToolId[] = [
  "search_files",
  "create_file",
  "edit_file",
  "list_files",
  "read_file",
  "execute_command",
  "stop",
];

function isValidToolId(id: string): id is ToolId {
  return validToolIds.includes(id as ToolId);
}

function parseToolTag(content: string): Action | null {
  const toolMatch = content.match(/<(\w+)>([\s\S]*?)<\/\1>/);
  if (!toolMatch) return null;

  const toolId = toolMatch[1];
  if (!isValidToolId(toolId)) return null;

  const paramsContent = toolMatch[2].trim();
  const params: Record<string, string> = {};

  // タグ内のテキストを直接パラメータとして扱う
  if (!paramsContent.includes("<")) {
    params.content = paramsContent;
    return { toolId, params };
  }

  const paramMatches = paramsContent.matchAll(/<(\w+)>([\s\S]*?)<\/\1>/g);
  for (const match of paramMatches) {
    const [, paramName, paramValue] = match;
    params[paramName] = paramValue.trim();
  }

  return {
    toolId,
    params,
  };
}

export function parseAssistantMessage(message: string): MessageBlock[] {
  if (!message) {
    return [{ type: "plain", content: "" }];
  }

  const blocks: MessageBlock[] = [];
  let currentIndex = 0;

  while (currentIndex < message.length) {
    const toolTagStart = message.indexOf("<", currentIndex);

    if (toolTagStart === -1) {
      // 残りのテキストをプレーンブロックとして追加
      const remainingText = message.slice(currentIndex);
      if (remainingText) {
        blocks.push({ type: "plain", content: remainingText });
      }
      break;
    }

    // ツールタグの前のテキストをプレーンブロックとして追加
    if (toolTagStart > currentIndex) {
      blocks.push({
        type: "plain",
        content: message.slice(currentIndex, toolTagStart),
      });
    }

    // ツールタグを探す
    const potentialToolContent = message.slice(toolTagStart);
    const action = parseToolTag(potentialToolContent);

    if (action) {
      blocks.push({ type: "action", action });
      // 次のタグの開始位置を見つける
      const toolTagEnd =
        potentialToolContent.indexOf(`</${action.toolId}>`) +
        action.toolId.length +
        3;
      currentIndex = toolTagStart + toolTagEnd;
    } else {
      // 無効なタグの場合は、'<'をプレーンテキストとして扱う
      blocks.push({
        type: "plain",
        content: message[toolTagStart],
      });
      currentIndex = toolTagStart + 1;
    }
  }

  // 連続するプレーンブロックをマージ
  const mergedBlocks: MessageBlock[] = [];
  let currentPlainContent = "";

  for (const block of blocks) {
    if (block.type === "plain") {
      currentPlainContent += block.content;
    } else {
      if (currentPlainContent) {
        mergedBlocks.push({ type: "plain", content: currentPlainContent });
        currentPlainContent = "";
      }
      mergedBlocks.push(block);
    }
  }

  if (currentPlainContent) {
    mergedBlocks.push({ type: "plain", content: currentPlainContent });
  }

  return mergedBlocks.length
    ? mergedBlocks
    : [{ type: "plain", content: message }];
}
