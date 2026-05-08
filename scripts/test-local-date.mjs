// Regression test for src/services/local-date.ts.
// Verifies that the timezone-aware helpers fix the UTC date-bucket bug
// (a São Paulo user at 22:30 BRT no longer sees data for "tomorrow").
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

// Force a known timezone before importing the module — the resolved value
// is captured at module load.
process.env.NOURISH_TIMEZONE = "America/Sao_Paulo";
process.env.NOURISH_LOCAL_DIR = `/tmp/nourish-local-date-${process.pid}`;

const { localDate, localDateFor, dateToNoonTimestamp, getActiveTimezone } = await import(
  "../dist/services/local-date.js"
);

// 1. The active tz is what we set.
assert.equal(getActiveTimezone(), "America/Sao_Paulo");

// 2. localDate() returns YYYY-MM-DD format.
assert.match(localDate(), /^\d{4}-\d{2}-\d{2}$/);

// 3. localDateFor(specific timestamp, tz) buckets correctly.
//    A user in São Paulo at 22:30 BRT on May 7 — that's 01:30 UTC May 8.
//    Slice-to-10 of the UTC string would give "May 8" (the bug).
//    The helper must give "May 7".
const lateBRT = new Date("2026-05-08T01:30:00Z"); // 22:30 BRT on May 7
assert.equal(
  localDateFor(lateBRT, "America/Sao_Paulo"),
  "2026-05-07",
  "São Paulo 22:30 must bucket as May 7, not May 8 (the old UTC slice bug)",
);

// 4. UTC tz cross-check — same instant in UTC bucket is May 8.
assert.equal(
  localDateFor(lateBRT, "UTC"),
  "2026-05-08",
  "UTC bucket sanity check",
);

// 5. Tokyo (UTC+9): 10:30 JST on May 8 — that's 01:30 UTC May 8.
assert.equal(
  localDateFor(lateBRT, "Asia/Tokyo"),
  "2026-05-08",
  "Tokyo bucket sanity check",
);

// 6. dateToNoonTimestamp returns noon-LOCAL as a UTC ISO string.
//    Noon SP (BRT, UTC-3) on May 7 = 15:00 UTC May 7.
const spNoon = dateToNoonTimestamp("2026-05-07", "America/Sao_Paulo");
assert.equal(spNoon, "2026-05-07T15:00:00.000Z", `expected SP noon = 15:00 UTC, got ${spNoon}`);

// Tokyo noon (JST, UTC+9) on May 7 = 03:00 UTC May 7.
const tkNoon = dateToNoonTimestamp("2026-05-07", "Asia/Tokyo");
assert.equal(tkNoon, "2026-05-07T03:00:00.000Z", `expected Tokyo noon = 03:00 UTC, got ${tkNoon}`);

// UTC noon — the legacy ${date}T12:00:00.000Z still works for UTC.
const utcNoon = dateToNoonTimestamp("2026-05-07", "UTC");
assert.equal(utcNoon, "2026-05-07T12:00:00.000Z");

// 7. Undefined date returns undefined (safe passthrough).
assert.equal(dateToNoonTimestamp(undefined), undefined);

// 8. Garbage input returns undefined (defensive — won't crash).
assert.equal(dateToNoonTimestamp("not-a-date"), undefined);

console.log("local-date helper tests ok");
