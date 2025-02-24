import { Readability } from "@mozilla/readability";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import * as jsdom from "jsdom";
import fetch from "node-fetch";

// Turndown related imports
import TurndownService from "turndown";
import type {
  Tool,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolId,
} from "../tool";

// URL validation function
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Check for private IP addresses
function isPrivateIP(hostname: string): boolean {
  const privateRanges = [
    /^0\./,
    /^10\./,
    /^127\./,
    /^169\.254\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^fc00:/,
    /^fe80:/,
  ];

  return privateRanges.some((range) => range.test(hostname));
}

// Check if the URL is potentially unsafe
export function isUnsafeUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    // Block localhost access
    if (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1"
    ) {
      return true;
    }

    // Block private IP addresses
    if (isPrivateIP(url.hostname)) {
      return true;
    }

    // Block file protocol
    if (url.protocol === "file:") {
      return true;
    }

    return false;
  } catch {
    return true;
  }
}

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

export async function getMarkdownFromPage(url: string): Promise<string | null> {
  // URL validation
  if (!isValidUrl(url)) {
    throw new Error("Invalid URL format or unsupported protocol");
  }

  if (isUnsafeUrl(url)) {
    throw new Error("Access to this URL is not allowed for security reasons");
  }

  // 1. Get HTML content from the URL
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch: ${response.status} ${response.statusText}`,
    );
  }
  const html = await response.text();

  // 2. Extract content from HTML using JSDOM & Readability
  // Use virtualConsole to suppress console.error when CSS parsing errors occur
  const virtualConsole = new jsdom.VirtualConsole();
  const dom = new JSDOM(html, { url, virtualConsole });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article) {
    return null;
  }

  // Get the readable HTML content extracted by Readability
  const readableHtml = article.content;

  // 3. Clean up unnecessary tags using Cheerio
  const $ = cheerio.load(readableHtml);

  // Define allowed HTML tags
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

  // Remove disallowed tags while preserving their content
  $("*").each((_, el) => {
    // @ts-ignore
    const tagName = el.name?.toLowerCase();
    if (!allowedTags.has(tagName)) {
      // Preserve child elements' content while removing the parent tag
      $(el).replaceWith($(el).contents());
    }
  });

  // Clean up attributes, keeping only essential ones (href for links, src for images)
  $("*").each((_, el) => {
    // @ts-ignore
    const attribs = el.attribs;
    for (const attrName of Object.keys(attribs)) {
      // @ts-ignore
      const tagName = el.name?.toLowerCase();
      if (tagName === "a" && attrName === "href") {
        // URLのサニタイズ
        const href = $(el).attr("href");
        if (href) {
          try {
            const fullUrl = new URL(href, url).href;
            if (!isUnsafeUrl(fullUrl)) {
              $(el).attr("href", fullUrl);
            } else {
              $(el).removeAttr("href");
            }
          } catch {
            $(el).removeAttr("href");
          }
        }
      } else if (tagName === "img" && attrName === "src") {
        // 画像URLのサニタイズ
        const src = $(el).attr("src");
        if (src) {
          try {
            const fullUrl = new URL(src, url).href;
            if (!isUnsafeUrl(fullUrl)) {
              $(el).attr("src", fullUrl);
            } else {
              $(el).removeAttr("src");
            }
          } catch {
            $(el).removeAttr("src");
          }
        } else {
          $(el).removeAttr(attrName);
        }
      }
    }
  });

  // スクリプトタグの完全な除去
  $("script").remove();
  // インラインスタイルの除去
  $("[style]").removeAttr("style");
  // イベントハンドラの除去
  $("*[onclick], *[onload], *[onerror]").each((_, el) => {
    $(el).removeAttr("onclick").removeAttr("onload").removeAttr("onerror");
  });

  // 4. Get the cleaned HTML
  const cleanedHtml = $.html();

  // 5. Convert the cleaned HTML to Markdown using turndown
  const markdown = turndownService.turndown(cleanedHtml);

  // 6. Add the title to the beginning of the markdown
  const title = $(readableHtml).find("title").text();
  return `# ${title}\n\n${markdown}`;
}
