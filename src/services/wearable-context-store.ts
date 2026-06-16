/**
 * Shared wearable-context reader (delx-wellness-context/v1).
 *
 * The Nourish coach tools accept a `wearable_context` INPUT so an orchestrating
 * agent can hand recovery/sleep/strain signals to meal coaching. This module
 * lets Nourish *read* that context from the shared Delx Wellness directory
 * instead of requiring the agent to pass it inline every call.
 *
 * STATUS / PREREQUISITE (2026-06):
 *   The wearable connectors (whoop-mcp, garmin-mcp, oura-mcp, strava-mcp,
 *   eight-sleep-mcp, google-health-mcp) all BUILD a `delx-wellness-context/v1`
 *   payload on demand inside their `*_wellness_context` tool, but none of them
 *   currently PERSISTS that payload to disk — the only file they write to
 *   ~/.delx-wellness/ is profile.json. So until a producer starts writing the
 *   context here, this reader returns `available: false`.
 *
 *   This module defines the read side of the contract so the producers have a
 *   concrete target to write to:
 *
 *     ~/.delx-wellness/wearable-context.json      (single latest snapshot)
 *     ~/.delx-wellness/wearable-context/<src>.json (per-source snapshots)
 *
 *   A producer should write the same envelope shape it returns from its
 *   *_wellness_context tool, optionally adding `generated_at` (ISO 8601). When
 *   multiple per-source files exist, the most recent `generated_at` wins.
 *
 * This never fabricates data: if no file exists it reports unavailability and
 * names the expected path so the agent can explain the gap to the user.
 */
/// <reference types="node" />

import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const WELLNESS_DIR = join(homedir(), ".delx-wellness");
const SINGLE_CONTEXT_PATH = join(WELLNESS_DIR, "wearable-context.json");
const CONTEXT_DIR = join(WELLNESS_DIR, "wearable-context");

export interface WearableContextResult {
  available: boolean;
  /** The most-recent wellness_context envelope, when one was found on disk. */
  context?: Record<string, unknown>;
  /** Where the context was read from (absolute path), when available. */
  source_path?: string;
  /** All paths that were checked, for transparency in agent responses. */
  checked_paths: string[];
  /** Human-readable note explaining availability / the pending prerequisite. */
  note: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function readJsonFile(path: string): Promise<Record<string, unknown> | undefined> {
  try {
    const raw = await fs.readFile(path, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function generatedAtMs(context: Record<string, unknown>): number {
  const value = context.generated_at;
  if (typeof value === "string") {
    const ms = Date.parse(value);
    if (Number.isFinite(ms)) {
      return ms;
    }
  }
  return 0;
}

/** The path producers should write a single latest snapshot to. */
export function getWearableContextPath(): string {
  return SINGLE_CONTEXT_PATH;
}

/**
 * Read the most-recent wearable context from the shared Delx Wellness dir.
 * Prefers the most recent per-source snapshot under wearable-context/, then
 * falls back to the single wearable-context.json snapshot. Returns
 * `available: false` (never throws) when nothing is present.
 */
export async function readLatestWearableContext(): Promise<WearableContextResult> {
  const checkedPaths: string[] = [CONTEXT_DIR, SINGLE_CONTEXT_PATH];

  // 1. Per-source snapshots: pick the newest by generated_at.
  let best: { context: Record<string, unknown>; path: string; ms: number } | undefined;
  try {
    const files = await fs.readdir(CONTEXT_DIR);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const path = join(CONTEXT_DIR, file);
      const context = await readJsonFile(path);
      if (context === undefined) continue;
      const ms = generatedAtMs(context);
      if (best === undefined || ms >= best.ms) {
        best = { context, path, ms };
      }
    }
  } catch {
    // Directory absent — fall through to the single-file path.
  }

  // 2. Single-file snapshot fallback.
  if (best === undefined) {
    const context = await readJsonFile(SINGLE_CONTEXT_PATH);
    if (context !== undefined) {
      best = { context, path: SINGLE_CONTEXT_PATH, ms: generatedAtMs(context) };
    }
  }

  if (best === undefined) {
    return {
      available: false,
      checked_paths: checkedPaths,
      note:
        "No shared wearable context found. The wearable connectors (WHOOP, Garmin, Oura, Strava, Eight Sleep, Google Health) " +
        `do not yet persist their wellness_context to disk — write one to ${SINGLE_CONTEXT_PATH} ` +
        "(or ~/.delx-wellness/wearable-context/<source>.json) to enable auto-pull. " +
        "Until then, pass wearable_context inline to the coach tools.",
    };
  }

  const source =
    typeof best.context.source === "string" && best.context.source.trim().length > 0
      ? best.context.source
      : "wearable";

  return {
    available: true,
    context: best.context,
    source_path: best.path,
    checked_paths: checkedPaths,
    note: `Loaded ${source} wellness_context from ${best.path}.`,
  };
}
