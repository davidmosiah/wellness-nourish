import { existsSync } from "node:fs";
import { join } from "node:path";

import { getConfig } from "./config.js";

export interface NourishConnectionStatus {
  ok: true;
  fixture_mode: boolean;
  local_dir: string;
  intake_store_exists: boolean;
  usda_api_key_configured: boolean;
  usda_mode: "api_key" | "demo_key_or_fixture";
  open_food_facts_enabled: boolean;
  cache_ttl_seconds: number;
  max_results: number;
  next_steps: string[];
}

export function buildConnectionStatus(): NourishConnectionStatus {
  const config = getConfig();
  const usdaApiKeyConfigured = Boolean(config.usda_api_key);

  return {
    ok: true,
    fixture_mode: config.fixture_mode,
    local_dir: config.local_dir,
    intake_store_exists: existsSync(join(config.local_dir, "intake.jsonl")),
    usda_api_key_configured: usdaApiKeyConfigured,
    usda_mode: usdaApiKeyConfigured ? "api_key" : "demo_key_or_fixture",
    open_food_facts_enabled: config.off_enabled,
    cache_ttl_seconds: config.cache_ttl_seconds,
    max_results: config.max_results,
    next_steps: buildNextSteps(usdaApiKeyConfigured, config.off_enabled),
  };
}

function buildNextSteps(usdaApiKeyConfigured: boolean, openFoodFactsEnabled: boolean): string[] {
  const nextSteps = ["Use nourish_search_food for generic foods."];

  if (openFoodFactsEnabled) {
    nextSteps.push("Use nourish_lookup_barcode for packaged foods.");
  } else {
    nextSteps.push("Set NOURISH_OFF_ENABLED=1 to enable packaged-food barcode lookup.");
  }

  nextSteps.push("Confirm before logging estimated meals.");

  if (!usdaApiKeyConfigured) {
    nextSteps.push(
      "Set FDC_API_KEY for higher USDA FoodData Central quota; DEMO_KEY or fixture mode can still be used for light checks.",
    );
  }

  return nextSteps;
}
