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
        name: "review day",
        steps: [
          "Call nourish_daily_summary with response_format markdown for human review.",
          "Use nourish_list_intake when the user wants to edit a specific item.",
          "Use nourish_update_intake or nourish_delete_intake only for the selected id.",
        ],
      },
      {
        name: "goals and hydration",
        steps: [
          "Use nourish_get_goals before comparing totals to targets.",
          "Call nourish_log_water only after explicit user intent.",
          "Treat goals as local tracking preferences, not medical guidance.",
        ],
      },
      {
        name: "Hermes Telegram personal tracker",
        steps: [
          "Install with wellness-nourish setup --client hermes --profile personal.",
          "Use direct mcp_nourish_* tools from Hermes instead of terminal workarounds.",
          "For plain Telegram meal messages, preview first and ask before saving.",
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
      "Keep local food logs out of chat unless the user asks to inspect or export them.",
      "Preserve source attribution and confidence values.",
      "Do not present nutrition estimates as medical advice.",
    ],
  };
}
