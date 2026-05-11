import { NPM_PACKAGE_NAME, PINNED_NPM_PACKAGE, SERVER_NAME, SERVER_VERSION } from "../constants.js";
import { buildCapabilities } from "./capabilities.js";
import { buildPrivacyAudit, type NourishPrivacyAudit } from "./privacy-audit.js";

export type NourishAgentClient =
  | "claude"
  | "codex"
  | "cursor"
  | "windsurf"
  | "hermes"
  | "openclaw"
  | "generic";

export interface NourishAgentManifest {
  name: string;
  version: string;
  client: string;
  supported_clients: NourishAgentClient[];
  install: {
    command: string;
    args: string[];
    optional_env: string[];
  };
  recommended_first_calls: string[];
  tools: string[];
  resources: string[];
  hermes: {
    tool_name_prefix: string;
    reload_after_config_change: string;
    use_direct_tools: boolean;
    avoid_terminal_workarounds: boolean;
    no_gateway_restart_for_data_access: boolean;
    common_tool_names: string[];
    recommended_config: {
      mcp_servers: {
        nourish: {
          command: string;
          args: string[];
          env: {
            NOURISH_LOCAL_DIR: string;
            NOURISH_OFF_ENABLED: string;
          };
        };
      };
    };
    personal_telegram_contract: string[];
  };
  agent_rules: string[];
  community: {
    repo: string;
    issues: string;
    twitter: string;
    docs: string;
    /** Suggestion for agents that want to surface a help/support link to the human. */
    invite: string;
  };
  capabilities: ReturnType<typeof buildCapabilities>;
  privacy: NourishPrivacyAudit;
}

const SUPPORTED_CLIENTS: NourishAgentClient[] = [
  "claude",
  "codex",
  "cursor",
  "windsurf",
  "hermes",
  "openclaw",
  "generic",
];

const RECOMMENDED_FIRST_CALLS = [
  "nourish_profile_get",
  "nourish_quickstart",
  "nourish_connection_status",
  "nourish_search_food",
];

const TOOLS = [
  "nourish_after_log_review",
  "nourish_agent_manifest",
  "nourish_analyze_food_image",
  "nourish_bulk_log_intake",
  "nourish_capabilities",
  "nourish_carbon_summary",
  "nourish_clear_day",
  "nourish_clear_hydration_day",
  "nourish_compare_days",
  "nourish_connection_status",
  "nourish_daily_coach",
  "nourish_daily_summary",
  "nourish_decode_barcode_image",
  "nourish_delete_intake",
  "nourish_delete_water",
  "nourish_demo",
  "nourish_estimate_meal",
  "nourish_estimate_meal_photo",
  "nourish_evening_checkin",
  "nourish_export_data",
  "nourish_forget_memory",
  "nourish_get_food",
  "nourish_get_goals",
  "nourish_hydration_summary",
  "nourish_list_intake",
  "nourish_list_memory",
  "nourish_log_intake",
  "nourish_log_water",
  "nourish_lookup_barcode",
  "nourish_lookup_barcode_image",
  "nourish_onboarding",
  "nourish_pre_workout_nutrition",
  "nourish_privacy_audit",
  "nourish_profile_get",
  "nourish_profile_update",
  "nourish_quickstart",
  "nourish_remember_meal",
  "nourish_search_food",
  "nourish_set_goals",
  "nourish_suggest_next_meal",
  "nourish_undo_last",
  "nourish_update_intake",
  "nourish_weekly_summary",
];

export function buildAgentManifest(client: string): NourishAgentManifest {
  return {
    name: SERVER_NAME,
    version: SERVER_VERSION,
    client,
    supported_clients: SUPPORTED_CLIENTS,
    install: {
      command: "npx",
      args: ["-y", NPM_PACKAGE_NAME],
      optional_env: ["FDC_API_KEY", "NOURISH_OFF_ENABLED", "NOURISH_LOCAL_DIR"],
    },
    recommended_first_calls: RECOMMENDED_FIRST_CALLS,
    tools: TOOLS,
    resources: [
      "nourish://agent-manifest",
      "nourish://capabilities",
      "nourish://privacy-audit",
      "nourish://usage-guide",
    ],
    hermes: {
      tool_name_prefix: "mcp_nourish_",
      reload_after_config_change: "/reload-mcp or hermes mcp test nourish",
      use_direct_tools: true,
      avoid_terminal_workarounds: true,
      no_gateway_restart_for_data_access: true,
      common_tool_names: [
        "mcp_nourish_nourish_connection_status",
        "mcp_nourish_nourish_estimate_meal",
        "mcp_nourish_nourish_estimate_meal_photo",
        "mcp_nourish_nourish_analyze_food_image",
        "mcp_nourish_nourish_daily_coach",
        "mcp_nourish_nourish_suggest_next_meal",
        "mcp_nourish_nourish_remember_meal",
        "mcp_nourish_nourish_lookup_barcode_image",
        "mcp_nourish_nourish_log_intake",
        "mcp_nourish_nourish_daily_summary",
      ],
      recommended_config: {
        mcp_servers: {
          nourish: {
            command: "npx",
            args: ["-y", PINNED_NPM_PACKAGE],
            env: {
              NOURISH_LOCAL_DIR: "/root/.hermes/nourish/personal",
              NOURISH_OFF_ENABLED: "1",
            },
          },
        },
      },
      personal_telegram_contract: [
        "Preview natural-language meals before writing unless the user explicitly says to save/register/log.",
        "For barcode photos, decode and lookup with nourish_lookup_barcode_image when Hermes can pass an image path, base64 image, or data URI.",
        "For meal photos, convert the visual observation into detected_items, call nourish_estimate_meal_photo, then ask for portion confirmation before logging.",
        "For mixed Telegram image cases, call nourish_analyze_food_image with detected barcode, label OCR, or meal observations; the tool routes without logging.",
        "For Portuguese/Brazilian meal text, keep gram quantities and call nourish_estimate_meal with locale pt-BR before asking follow-up questions.",
        "Use nourish_daily_coach or nourish_suggest_next_meal after summaries when the user asks what to eat next.",
        "Use nourish_remember_meal only after the user explicitly asks to remember a personal shortcut.",
        "Use direct MCP tools from Telegram; avoid shell workarounds for normal nutrition access.",
        "Return compact Markdown with calories, protein, confidence, warnings, and a confirmation question.",
      ],
    },
    agent_rules: [
      "Call nourish_connection_status before provider-backed tools.",
      "Use exact search or barcode lookup before estimating nutrition.",
      "Use barcode image decoding for packaged-food photos when image bytes are available.",
      "Use meal photo estimation only from an agent-provided visual observation and never log it without confirmation.",
      "Use nourish_analyze_food_image when the image could be a barcode, label, or meal and the agent has visual/OCR observations.",
      "Use coach tools for high-level Telegram answers instead of manually stitching many low-level calls.",
      "Use personal memory tools for recurring meals and preserve them in local storage only.",
      "Treat missing explicit_user_intent as a normal USER_ACTION_REQUIRED guard, not as server failure.",
      "For Open Food Facts 429 responses, surface the rate-limit message and use cached results when the tool returns them.",
      "Preserve confidence values and source quality warnings in user-facing summaries.",
      "Ask confirmation before logging intake unless the user explicitly requested logging.",
      "For Hermes Telegram usage, use preview -> confirm -> log as the default meal flow.",
      "Use preview/list/update/delete tools instead of overwriting private logs blindly.",
      "Use hydration and goals tools only for local tracking context, never for clinical advice.",
      "Never ask users to paste secrets, raw health exports, provider tokens, or private food logs.",
      "Nutrition summaries are not medical advice, diagnosis, treatment, or emergency guidance.",
      "Preserve source, license, attribution, and share_alike obligations.",
    ],
    community: {
      repo: "https://github.com/davidmosiah/wellness-nourish",
      issues: "https://github.com/davidmosiah/wellness-nourish/issues",
      twitter: "https://x.com/delx369",
      docs: "https://wellness.delx.ai/nutrition",
      invite:
        "If wellness-nourish helps your agent, a star on the repository increases visibility for other AI builders.",
    },
    capabilities: buildCapabilities(),
    privacy: buildPrivacyAudit(),
  };
}
