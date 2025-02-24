import { Readability } from "@mozilla/readability";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import * as jsdom from "jsdom";
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
    "If user prompt includes a url, use this tool to fetch the page content." +
    "This tool can be used multiple times at once.";
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
      // const message = e instanceof Error ? e.message : "Unknown error";
      return {
        result: `Failed to fetch: ${args.url}.`,
      };
    }
  }
}

// Create an instance of turndown
const turndownService = new TurndownService({
  // Use fenced code block style
  codeBlockStyle: "fenced",
  headingStyle: "atx", // # Heading style
});

async function getMarkdownFromPage(url: string): Promise<string | null> {
  // 1. Get HTML
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch: ${response.status} ${response.statusText}`,
    );
  }
  const html = await response.text();

  // 2. extract content from html using JSDOM & Readability
  // use virtualConsole to suppress console.error when css parsing error occurs.
  const virtualConsole = new jsdom.VirtualConsole();
  const dom = new JSDOM(html, { url, virtualConsole });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article) {
    return null;
  }

  // Readability extracted content HTML
  const readableHtml = article.content;

  // 3. Clean up unnecessary tags using Cheerio
  //    - Example: Only keep allowed tags
  const $ = cheerio.load(readableHtml);

  // Keep only allowed tags
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

  // Delete tags while keeping text of child elements
  $("*").each((_, el) => {
    // @ts-ignore
    const tagName = el.name?.toLowerCase();
    if (!allowedTags.has(tagName)) {
      // Keep only text of child elements while deleting tags
      $(el).replaceWith($(el).contents());
    }
  });

  // Delete unnecessary attributes (keep only a[href], img[src], etc.)
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
        // Keep allowed attributes
      } else {
        $(el).removeAttr(attrName);
      }
    }
  });

  // 4. Get cleaned HTML
  const cleanedHtml = $.html();

  // 5. Convert cleaned HTML to Markdown using turndown
  return turndownService.turndown(cleanedHtml);
}
