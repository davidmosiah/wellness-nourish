/// <reference types="node" />

/**
 * Timezone-aware date helpers.
 *
 * Before this module, three independently-defined `todayDate()` helpers in
 * `summary.ts`, `coach.ts`, and `hydration-store.ts` all returned
 * `new Date().toISOString().slice(0, 10)` — i.e. UTC. A user in São Paulo
 * (UTC-3) at 22:30 BRT on May 7 saw `nourish_daily_summary` return data
 * for "May 8". A user in Los Angeles (UTC-7/-8) lost ~7-8 hrs of late-evening
 * logs from "today". `dateToNoonTimestamp(date)` had the same bug — `12:00:00Z`
 * is morning, not noon, for any user not on UTC.
 *
 * This module centralizes timezone resolution and date bucketing.
 *
 * Configuration:
 *   - `NOURISH_TIMEZONE` env var (IANA name like "America/Sao_Paulo") wins
 *   - Otherwise falls back to the system's resolved timezone
 *
 * For tools, callers can pass an explicit `timezone` argument; the active
 * default is what `getActiveTimezone()` returns.
 */

const RESOLVED_TIMEZONE = (() => {
  const fromEnv = process.env.NOURISH_TIMEZONE?.trim();
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }
  try {
    const systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (systemTz && systemTz.length > 0) {
      return systemTz;
    }
  } catch {
    // Some restricted environments throw — fall through to UTC.
  }
  return "UTC";
})();

export function getActiveTimezone(): string {
  return RESOLVED_TIMEZONE;
}

/**
 * Format a Date as YYYY-MM-DD in the active (or supplied) timezone.
 * Uses `en-CA` locale because it formats as YYYY-MM-DD natively.
 */
export function localDateFor(date: Date, timezone = RESOLVED_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Today's YYYY-MM-DD in the active (or supplied) timezone. */
export function localDate(timezone = RESOLVED_TIMEZONE): string {
  return localDateFor(new Date(), timezone);
}

/**
 * Convert a YYYY-MM-DD date string into the UTC ISO timestamp for noon-local
 * time on that date in the active (or supplied) timezone.
 *
 * Replaces the legacy `${date}T12:00:00.000Z` shortcut, which was UTC noon
 * (= early morning for any user east of UTC, or evening for any user west).
 */
export function dateToNoonTimestamp(
  date: string | undefined,
  timezone = RESOLVED_TIMEZONE,
): string | undefined {
  if (date === undefined) {
    return undefined;
  }
  // Anchor: noon UTC on this calendar date, then shift by the offset between
  // UTC and the target timezone *at that moment*. This handles DST correctly
  // because `computeTimezoneOffsetMinutes` re-evaluates at the anchor time.
  const utcNoonAnchor = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(utcNoonAnchor.getTime())) {
    return undefined;
  }
  const offsetMinutes = computeTimezoneOffsetMinutes(utcNoonAnchor, timezone);
  const noonLocalAsUtc = utcNoonAnchor.getTime() - offsetMinutes * 60 * 1000;
  return new Date(noonLocalAsUtc).toISOString();
}

/**
 * Minutes that the given timezone is OFFSET FROM UTC at the supplied
 * instant. Eastern timezones return positive numbers (+180 for São Paulo /
 * UTC-3? No — see test: this returns the *difference* between the LOCAL
 * wall clock at that instant and UTC, expressed as minutes the local
 * is AHEAD of UTC; SP is BEHIND UTC, so it returns -180).
 */
function computeTimezoneOffsetMinutes(at: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  let hour = get("hour");
  if (hour === 24) hour = 0;
  const localAsUtcMs = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    hour,
    get("minute"),
    get("second"),
  );
  return (localAsUtcMs - at.getTime()) / 60000;
}
