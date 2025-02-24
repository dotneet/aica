import { Readability } from "@mozilla/readability";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import fetch from "node-fetch";

// turndown 関連
import TurndownService from "turndown";
import type {
  Tool,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolId,
} from "../tool";

export class WebFetchTool implements Tool {
  name: ToolId = "web_fetch";
  description =
    "Fetch a page content from a web page." +
    "If user prompt includes a url, use this tool to fetch the page content.";
  params = {
    url: {
      type: "string",
      description: "The url of the web page to fetch",
    },
  };
  example = `<web_fetch>
<url>https://www.google.com</url>
</web_fetch>
`.trim();

  async execute(
    context: ToolExecutionContext,
    args: {
      url: string;
    },
  ): Promise<ToolExecutionResult> {
    try {
      const markdown = await getMarkdownFromPage(args.url);
      if (!markdown) {
        return {
          result: `Failed to fetch: ${args.url}`,
        };
      }
      return {
        result: `Successfully fetched from ${args.url}.\n${markdown}`,
      };
    } catch (e) {
      return {
        result: `Failed to fetch: ${args.url}`,
      };
    }
  }
}

// turndownのインスタンスを作る
const turndownService = new TurndownService({
  // コードブロックを ``` で囲むスタイルを使用
  codeBlockStyle: "fenced",
  headingStyle: "atx", // # Heading スタイル
});

async function getMarkdownFromPage(url: string): Promise<string | null> {
  try {
    // 1. HTML を取得
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch: ${response.status} ${response.statusText}`,
      );
    }
    const html = await response.text();

    // 2. JSDOM & Readability で本文抽出
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article) {
      return null;
    }

    // Readabilityが抽出した本文HTML
    const readableHtml = article.content;

    // 3. Cheerio で不要なタグをクリーニング
    //    - 例として「許可するタグだけ残す」方式
    const $ = cheerio.load(readableHtml);

    // 残したいHTMLタグをホワイトリスト化 (必要に応じて調整)
    const allowedTags = new Set([
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "ul",
      "ol",
      "li",
      "blockquote",
      "strong",
      "em",
      "b",
      "i",
      "code",
      "pre",
      "br",
      "hr",
      "a",
      "img",
    ]);

    // タグそのものを削除しつつ子要素のテキストは残す
    $("*").each((_, el) => {
      // @ts-ignore
      const tagName = el.name?.toLowerCase();
      if (!allowedTags.has(tagName)) {
        // 子要素のテキストだけを残してタグは削除
        $(el).replaceWith($(el).contents());
      }
    });

    // 不要な属性を削除 (a[href], img[src] など最低限だけ残す)
    $("*").each((_, el) => {
      // @ts-ignore
      const attribs = el.attribs;
      for (const attrName of Object.keys(attribs)) {
        // @ts-ignore
        const tagName = el.name?.toLowerCase();
        if (
          (tagName === "a" && attrName === "href") ||
          (tagName === "img" && attrName === "src")
        ) {
          // 許可された属性は保持
        } else {
          $(el).removeAttr(attrName);
        }
      }
    });

    // 4. クリーニング後のHTMLを取得
    const cleanedHtml = $.html();

    // 5. turndown でMarkdownに変換
    const markdown = turndownService.turndown(cleanedHtml);

    return markdown;
  } catch (error) {
    console.error(error);
    return null;
  }
}
