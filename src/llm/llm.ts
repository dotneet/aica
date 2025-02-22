export interface LLM {
  generate(
    systemPrompt: string,
    prompts: Message[],
    jsonMode: boolean,
  ): Promise<string>;
}

export type Message = UserMessage | AssistantMessage;

export type UserMessage = {
  role: "user";
  content: string;
};

export type AssistantMessage = {
  role: "assistant";
  content: string;
};

export class LLMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMError";
  }
}

/**
 * テキストから最初のJSONを抽出する関数
 * @param text テキスト
 * @returns 見つかったJSONテキスト。見つからない場合はnull
 */
export function extractJsonFromText(text: string): string | null {
  // コードブロック内のJSONを探す正規表現
  const codeBlockRegex = /```(?:json)?\n({[\s\S]*?})\n```/;
  // 通常のテキスト内のJSONを探す正規表現（ネストされたJSONに対応）
  const jsonRegex = /{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*}/;

  // まずコードブロック内を探す
  const codeBlockMatch = text.match(codeBlockRegex);
  if (codeBlockMatch) {
    try {
      // 抽出したテキストがJSON形式か検証
      JSON.parse(codeBlockMatch[1]);
      return codeBlockMatch[1];
    } catch {
      // JSONとして無効な場合は次の検索に進む
    }
  }

  // 次に通常のテキスト内を探す
  const matches = text.match(jsonRegex);
  if (matches) {
    try {
      // 抽出したテキストがJSON形式か検証
      JSON.parse(matches[0]);
      return matches[0];
    } catch {
      return null;
    }
  }

  return null;
}
