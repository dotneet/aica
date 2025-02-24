import { type Action, ToolId, isValidToolId, validToolIds } from "./tool/mod";

export type MessageBlock = PlainMessageBlock | ActionBlock;

export interface PlainMessageBlock {
  type: "plain";
  content: string;
}

export interface ActionBlock {
  type: "action";
  action: Action;
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
  const processedMessage = message
    .replace(/<thinking>\s?/g, "")
    .replace(/\s?<\/thinking>/g, "");

  const blocks: MessageBlock[] = [];
  let currentIndex = 0;

  while (currentIndex < processedMessage.length) {
    const toolTagStart = processedMessage.indexOf("<", currentIndex);

    if (toolTagStart === -1) {
      // 残りのテキストをプレーンブロックとして追加
      const remainingText = processedMessage.slice(currentIndex);
      if (remainingText) {
        blocks.push({ type: "plain", content: remainingText });
      }
      break;
    }

    // ツールタグの前のテキストをプレーンブロックとして追加
    if (toolTagStart > currentIndex) {
      blocks.push({
        type: "plain",
        content: processedMessage.slice(currentIndex, toolTagStart),
      });
    }

    // ツールタグを探す
    const potentialToolContent = processedMessage.slice(toolTagStart);
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
        content: processedMessage[toolTagStart],
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
    : [{ type: "plain", content: processedMessage }];
}
