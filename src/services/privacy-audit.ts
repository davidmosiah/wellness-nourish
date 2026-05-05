import { getConfig } from "./config.js";

export interface NourishPrivacyAudit {
  local_storage: string;
  personal_data: string;
  secrets_returned_by_tools: boolean;
  raw_provider_tokens_returned_by_tools: boolean;
  default_search_mode: string;
  deletion: string;
  medical_boundary: string;
  source_license_boundary: string;
  agent_safety: string[];
}

export function buildPrivacyAudit(): NourishPrivacyAudit {
  const config = getConfig();

  return {
    local_storage: config.local_dir,
    personal_data: "intake logs only when explicitly logged",
    secrets_returned_by_tools: false,
    raw_provider_tokens_returned_by_tools: false,
    default_search_mode: "read-only",
    deletion:
      "Local intake logs can be deleted by entry through nourish_delete_intake or by removing the local intake.jsonl file in the configured local storage directory.",
    medical_boundary: "not medical advice/diagnosis/treatment/emergency",
    source_license_boundary:
      "USDA FoodData Central is the primary source. Open Food Facts metadata is ODbL share-alike and must preserve attribution and share-alike obligations.",
    agent_safety: [
      "never ask users to paste secrets, raw health exports, provider tokens, or private food logs",
      "return configuration booleans and paths, not secret values",
    ],
  };
}
