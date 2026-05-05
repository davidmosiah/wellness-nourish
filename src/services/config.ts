/// <reference types="node" />

import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { LOCAL_DIR_NAME } from "../constants.js";
import type { NourishConfig } from "../types.js";

function numberFromEnv(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getConfig(): NourishConfig {
  const local_dir = process.env.NOURISH_LOCAL_DIR ?? join(homedir(), LOCAL_DIR_NAME);
  const usda_api_key = process.env.FDC_API_KEY ?? process.env.USDA_FDC_API_KEY;
  mkdirSync(local_dir, { recursive: true });

  const config: NourishConfig = {
    local_dir,
    fixture_mode: process.env.NOURISH_FIXTURE_MODE === "1",
    off_enabled: process.env.NOURISH_OFF_ENABLED !== "0",
    cache_ttl_seconds: numberFromEnv(process.env.NOURISH_CACHE_TTL_SECONDS, 3600),
    max_results: numberFromEnv(process.env.NOURISH_MAX_RESULTS, 20),
  };

  if (usda_api_key !== undefined) {
    config.usda_api_key = usda_api_key;
  }

  return config;
}

export function getFixtureDir(): string {
  return process.env.NOURISH_FIXTURE_DIR ?? "fixtures";
}
