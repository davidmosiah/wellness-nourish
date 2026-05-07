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

  server.registerPrompt(
    "nourish_telegram_meal_log",
    {
      title: "Nourish Telegram meal log",
      description: "Handle a Telegram meal message with preview-before-write safety.",
    },
    async () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              "For a Telegram meal message, call nourish_connection_status if needed. For plain text meals, use nourish_estimate_meal first; saved personal labels are expanded locally. For barcode photos with image_path, image_base64, or image_data_uri, use nourish_lookup_barcode_image. For mixed image observations with barcode text, nutrition label OCR, or visible foods, use nourish_analyze_food_image. For meal photos, describe the visible food/portions as detected_items and call nourish_estimate_meal_photo. For 'what should I eat now?' questions, call nourish_daily_coach or nourish_suggest_next_meal and pass wearable context if another MCP supplied it. Reply with compact Markdown: calories, protein, confidence, unresolved items, warnings, and the confirmation question. If the user clearly asked to save/register/log and the estimate is already confirmed, call nourish_log_intake with explicit_user_intent true. Otherwise ask for confirmation before logging. Do not provide medical advice.",
          },
        },
      ],
    }),
  );
}
