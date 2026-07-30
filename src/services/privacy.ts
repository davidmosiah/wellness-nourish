/**
 * Agent-facing privacy modes for local nutrition data.
 * summary = high-level totals without item-level free text
 * structured = full agent-usable fields (default)
 * raw = same as structured for this local store (parity with wearables)
 */

export type PrivacyMode = "summary" | "structured" | "raw";

export function resolvePrivacyMode(input?: string | null): PrivacyMode {
  if (input === "summary" || input === "structured" || input === "raw") return input;
  return "structured";
}

/** Strip free-text food labels from a single intake entry for summary mode. */
export function redactIntakeEntryForPrivacy(
  entry: Record<string, unknown>,
  mode: PrivacyMode,
): Record<string, unknown> {
  if (mode !== "summary") return entry;
  return {
    id: entry.id,
    date: entry.date,
    timestamp: entry.timestamp,
    meal_type: entry.meal_type,
    confidence: entry.confidence,
    source_trace: entry.source_trace,
    tags: entry.tags,
    nutrients: entry.nutrients,
    // omit text/items/notes free text
    privacy_mode: "summary",
    redacted: true,
  };
}

export function redactIntakeListForPrivacy(
  entries: Record<string, unknown>[],
  mode: PrivacyMode,
): Record<string, unknown>[] {
  return entries.map((e) => redactIntakeEntryForPrivacy(e, mode));
}

/** Daily/weekly summary: summary mode drops per-entry detail if present. */
export function redactSummaryForPrivacy(
  summary: Record<string, unknown>,
  mode: PrivacyMode,
): Record<string, unknown> {
  if (mode !== "summary") return { ...summary, privacy_mode: mode };
  const { entries, items, meals, ...rest } = summary as Record<string, unknown> & {
    entries?: unknown;
    items?: unknown;
    meals?: unknown;
  };
  return {
    ...rest,
    privacy_mode: "summary",
    redacted: true,
    entry_count: summary.entry_count ?? (Array.isArray(entries) ? entries.length : undefined),
  };
}
