import { SERVER_NAME, SERVER_VERSION } from "../constants.js";

export interface NourishUsageGuide {
  name: string;
  version: string;
  first_minute: string[];
  agent_workflows: Array<{
    name: string;
    steps: string[];
  }>;
  human_cli: Record<string, string>;
  safety_rules: string[];
}

export function buildUsageGuide(): NourishUsageGuide {
  return {
    name: SERVER_NAME,
    version: SERVER_VERSION,
    first_minute: [
      "Call nourish_connection_status.",
      "Call nourish_capabilities.",
      "Read nourish://usage-guide.",
      "Use nourish_search_food or nourish_lookup_barcode before estimating whenever possible.",
      "Use nourish_search_food provider br_local for Brazilian staples and provider open_food_facts for packaged product name search.",
      "Use nourish_lookup_barcode_image for barcode photos and nourish_estimate_meal_photo for meal photos when the agent has image context.",
      "Use nourish_analyze_food_image when a Telegram image could be a barcode, nutrition label, or meal photo.",
      "For Brazilian Portuguese meals, preserve explicit grams and common aliases such as arroz branco cozido, feijão carioca, peito de frango grelhado, salada simples and ovos.",
      "Use nourish_daily_coach or nourish_suggest_next_meal when the user asks what to eat next.",
    ],
    agent_workflows: [
      {
        name: "preview before write",
        steps: [
          "Estimate with nourish_estimate_meal.",
          "Show calories, confidence, source trace, and warnings to the user.",
          "Call nourish_log_intake only after explicit user intent.",
        ],
      },
      {
        name: "barcode photo",
        steps: [
          "Call nourish_lookup_barcode_image with image_path, image_base64, or image_data_uri.",
          "If the barcode cannot be decoded, ask for a sharper, flatter image with the full barcode visible.",
          "Preserve Open Food Facts license and source attribution in exports or reusable records.",
        ],
      },
      {
        name: "mixed food image",
        steps: [
          "Pass detected_barcodes, nutrition_label_text, detected_items, and image_description to nourish_analyze_food_image.",
          "If route is barcode, confirm product and serving before logging.",
          "If route is nutrition_label, confirm OCR and serving before logging custom_food.",
          "If route is meal_photo, confirm portions before logging.",
        ],
      },
      {
        name: "meal photo preview",
        steps: [
          "Describe the visible food and detected portions from the agent vision layer.",
          "Call nourish_estimate_meal_photo with image_description and detected_items.",
          "Show the approximate estimate and ask the user to confirm portions before calling nourish_log_intake.",
        ],
      },
      {
        name: "Brazilian Portuguese meal text",
        steps: [
          "Pass the original pt-BR meal text to nourish_estimate_meal with locale pt-BR.",
          "Keep explicit gram quantities such as 200g arroz or 150g frango when present.",
          "If a common Brazilian food is still unresolved, ask one compact clarification instead of logging.",
        ],
      },
      {
        name: "review day",
        steps: [
          "Call nourish_daily_summary with response_format markdown for human review.",
          "Use nourish_list_intake when the user wants to edit a specific item.",
          "Use nourish_update_intake or nourish_delete_intake only for the selected id.",
        ],
      },
      {
        name: "coach loop",
        steps: [
          "Call nourish_daily_coach for a compact Telegram-ready read of the day.",
          "Pass wearable_context after calling WHOOP/Garmin/Oura/Eight Sleep tools when available.",
          "Use nourish_suggest_next_meal, nourish_pre_workout_nutrition, or nourish_evening_checkin for specific next-step questions.",
          "Never log the suggestion until the user confirms.",
        ],
      },
      {
        name: "personal meal memory",
        steps: [
          "When the user says to remember a recurring meal, call nourish_remember_meal with explicit_user_intent true.",
          "Use nourish_list_memory to inspect saved shortcuts.",
          "When a user says a remembered label such as 'meu cafe normal', nourish_estimate_meal expands it locally before estimating.",
        ],
      },
      {
        name: "goals and hydration",
        steps: [
          "Use nourish_get_goals before comparing totals to targets.",
          "Call nourish_log_water only after explicit user intent.",
          "Use nourish_delete_water { id, explicit_user_intent: true } to remove a single water entry, or nourish_clear_hydration_day { date, explicit_user_intent: true } to wipe a date.",
          "nourish_clear_day { date, explicit_user_intent: true } only clears intake by default — pass include_hydration: true to also wipe water for that date.",
          "Treat goals as local tracking preferences, not medical guidance.",
        ],
      },
      {
        name: "Hermes Telegram personal tracker",
        steps: [
          "Install with wellness-nourish setup --client hermes --profile personal.",
          "Use direct mcp_nourish_* tools from Hermes instead of terminal workarounds.",
          "For plain Telegram meal messages, preview first and ask before saving.",
          "For barcode photos, use mcp_nourish_nourish_lookup_barcode_image when Telegram image bytes or a local downloaded path are available.",
          "For meal photos, call mcp_nourish_nourish_estimate_meal_photo from the visual observation, then ask before saving.",
          "For explicit save/register/log messages, call nourish_log_intake with explicit_user_intent true.",
        ],
      },
    ],
    human_cli: {
      setup: "wellness-nourish setup --client claude",
      hermes_setup: "wellness-nourish setup --client hermes --profile personal",
      doctor: "wellness-nourish doctor",
      preview: "wellness-nourish log --preview --meal breakfast \"2 eggs and banana\"",
      list: "wellness-nourish list 2026-05-05",
      edit: "wellness-nourish edit --entry intake_id --meal snack --notes \"corrected\"",
      clear_day: "wellness-nourish clear-day 2026-05-05 --yes",
      hydration: "wellness-nourish water 500 --date 2026-05-05",
      goals: "wellness-nourish goals --set-calories 2200 --set-protein 120 --set-water 2500",
      csv_export: "wellness-nourish export --format csv",
    },
    safety_rules: [
      "Require explicit user intent for intake, hydration, goals, and deletion mutations.",
      "Never treat photo meal estimates as exact; keep confirmation between estimate and log.",
      "Keep local food logs out of chat unless the user asks to inspect or export them.",
      "Preserve source attribution and confidence values.",
      "Do not present nutrition estimates as medical advice.",
    ],
  };
}
