import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "test-stdio-server",
  version: "1.0.0",
});

server.tool(
  "test-tool",
  {
    arg: z.string(),
  },
  async (args) => ({
    content: [
      {
        type: "text",
        text: `Received arg: ${args.arg}`,
        mimeType: "text/plain",
      },
    ],
  }),
);

server.resource("test-resource", "test://resource", async () => ({
  contents: [
    {
      uri: "test://resource",
      text: "Test resource content",
      mimeType: "text/plain",
    },
  ],
}));

const transport = new StdioServerTransport();
await server.connect(transport);
