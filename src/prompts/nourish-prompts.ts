import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerNourishPrompts(server: McpServer): void {
  server.registerPrompt(
    "nourish_daily_review",
    {
      title: "Nourish daily review",
      description: "Review a day of logged nutrition while preserving confidence and source coverage.",
    },
    async () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              "Call nourish_daily_summary for the requested date or today's date. Summarize total nutrients, meal distribution, confidence, and source coverage. Preserve uncertainty, source quality, and license/attribution context. Do not provide medical advice, diagnosis, treatment, or emergency guidance.",
          },
        },
      ],
    }),
  );
}
