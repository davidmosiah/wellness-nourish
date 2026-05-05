import { SERVER_NAME, SERVER_VERSION } from "../constants.js";
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
  };
  agent_rules: string[];
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
  "nourish_connection_status",
  "nourish_capabilities",
  "nourish_search_food",
];

const TOOLS = [
  "nourish_agent_manifest",
  "nourish_capabilities",
  "nourish_privacy_audit",
  "nourish_connection_status",
  "nourish_search_food",
  "nourish_lookup_barcode",
  "nourish_get_food",
  "nourish_estimate_meal",
  "nourish_log_intake",
  "nourish_list_intake",
  "nourish_update_intake",
  "nourish_delete_intake",
  "nourish_clear_day",
  "nourish_log_water",
  "nourish_hydration_summary",
  "nourish_get_goals",
  "nourish_set_goals",
  "nourish_daily_summary",
  "nourish_weekly_summary",
  "nourish_export_data",
];

export function buildAgentManifest(client: string): NourishAgentManifest {
  return {
    name: SERVER_NAME,
    version: SERVER_VERSION,
    client,
    supported_clients: SUPPORTED_CLIENTS,
    install: {
      command: "npx",
      args: ["-y", "wellness-nourish"],
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
    },
    agent_rules: [
      "Call nourish_connection_status before provider-backed tools.",
      "Use exact search or barcode lookup before estimating nutrition.",
      "Preserve confidence values and source quality warnings in user-facing summaries.",
      "Ask confirmation before logging intake unless the user explicitly requested logging.",
      "Use preview/list/update/delete tools instead of overwriting private logs blindly.",
      "Use hydration and goals tools only for local tracking context, never for clinical advice.",
      "Never ask users to paste secrets, raw health exports, provider tokens, or private food logs.",
      "Nutrition summaries are not medical advice, diagnosis, treatment, or emergency guidance.",
      "Preserve source, license, attribution, and share_alike obligations.",
    ],
    capabilities: buildCapabilities(),
    privacy: buildPrivacyAudit(),
  };
}
