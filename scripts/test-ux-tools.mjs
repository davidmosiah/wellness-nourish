// Regression tests for the new UX tools in PR #12:
//   - nourish_bulk_log_intake
//   - nourish_compare_days
//   - nourish_daily_summary { compare_to: "yesterday" | "7d_avg" }
//   - nourish_list_intake new filters (since/until/meal_type/tag/source_trace/min_confidence/limit)
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

const fixtureDir = resolve("fixtures");
const localDir = mkdtempSync(`${tmpdir()}/nourish-ux-tools-`);
const client = new Client({ name: "ux-tools-test", version: "0.1.0" }, { capabilities: {} });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/index.js"],
  cwd: process.cwd(),
  stderr: "pipe",
  env: {
    ...process.env,
    NOURISH_FIXTURE_MODE: "1",
    NOURISH_FIXTURE_DIR: fixtureDir,
    NOURISH_LOCAL_DIR: localDir,
    NOURISH_TIMEZONE: "UTC",
  },
});

function textOf(result) {
  return result.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
}

try {
  await client.connect(transport);

  // === bulk_log_intake — atomic batch with per-item results ===
  const guarded = await client.callTool({
    name: "nourish_bulk_log_intake",
    arguments: { items: [{ text: "1 banana" }] },
  });
  const guardedPayload = JSON.parse(textOf(guarded));
  assert.equal(guardedPayload.error?.code, "USER_ACTION_REQUIRED", "explicit_user_intent guard");

  const bulk = await client.callTool({
    name: "nourish_bulk_log_intake",
    arguments: {
      explicit_user_intent: true,
      items: [
        { text: "2 ovos cozidos e 1 banana", meal_type: "breakfast" },
        { text: "200g arroz e 100g frango grelhado", meal_type: "lunch" },
        { text: "1 maçã", meal_type: "snack" },
      ],
    },
  });
  const bulkPayload = JSON.parse(textOf(bulk));
  assert.notEqual(bulk.isError, true);
  assert.equal(bulkPayload.total, 3);
  assert.equal(bulkPayload.ok_count, 3);
  assert.equal(bulkPayload.failed_count, 0);
  assert.equal(bulkPayload.results.length, 3);
  assert.ok(bulkPayload.results.every((r) => r.ok));
  assert.ok(bulkPayload.results.every((r) => r.entry?.id?.startsWith("intake_")));

  // === list_intake new filters ===
  const allEntries = await client.callTool({
    name: "nourish_list_intake",
    arguments: {},
  });
  const allEntriesPayload = JSON.parse(textOf(allEntries));
  assert.equal(allEntriesPayload.entries.length, 3);
  assert.equal(allEntriesPayload.count, 3);

  // Filter by meal_type
  const lunch = await client.callTool({
    name: "nourish_list_intake",
    arguments: { meal_type: "lunch" },
  });
  const lunchPayload = JSON.parse(textOf(lunch));
  assert.equal(lunchPayload.entries.length, 1);
  assert.equal(lunchPayload.entries[0].meal_type, "lunch");

  // Filter by min_confidence
  const highConf = await client.callTool({
    name: "nourish_list_intake",
    arguments: { min_confidence: 0.99 },
  });
  const highConfPayload = JSON.parse(textOf(highConf));
  // Estimator confidence is typically <1.0 for text, so this should be 0.
  assert.ok(highConfPayload.entries.every((e) => e.confidence >= 0.99));

  // Filter by source_trace
  const estimates = await client.callTool({
    name: "nourish_list_intake",
    arguments: { source_trace: "estimate" },
  });
  const estimatesPayload = JSON.parse(textOf(estimates));
  assert.ok(estimatesPayload.entries.every((e) => e.source_trace === "estimate"));

  // Limit
  const limited = await client.callTool({
    name: "nourish_list_intake",
    arguments: { limit: 1 },
  });
  const limitedPayload = JSON.parse(textOf(limited));
  assert.equal(limitedPayload.entries.length, 1);

  // applied_filters block must echo what was sent
  assert.equal(limitedPayload.applied_filters.limit, 1);

  // === daily_summary with compare_to: "yesterday" ===
  // Today is whatever the system returns; we already logged everything.
  // For a meaningful test, we need entries on different days.
  // Quick path: log directly on yesterday by giving an explicit timestamp.
  const yesterdayDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  await client.callTool({
    name: "nourish_log_intake",
    arguments: {
      explicit_user_intent: true,
      text: "yesterday baseline meal",
      meal_type: "lunch",
      timestamp: `${yesterdayDate}T12:00:00.000Z`,
    },
  });

  const summaryWithCompare = await client.callTool({
    name: "nourish_daily_summary",
    arguments: { compare_to: "yesterday" },
  });
  const summaryWithComparePayload = JSON.parse(textOf(summaryWithCompare));
  assert.notEqual(summaryWithCompare.isError, true);
  assert.ok(summaryWithComparePayload.comparison !== undefined, "comparison block must be present");
  assert.equal(summaryWithComparePayload.comparison.kind, "yesterday");
  assert.equal(summaryWithComparePayload.comparison.baseline_date, yesterdayDate);
  assert.ok(typeof summaryWithComparePayload.comparison.deltas === "object");
  assert.equal(typeof summaryWithComparePayload.comparison.entry_count_delta, "number");

  // compare_to: "none" (default) — no comparison block
  const summaryNoCompare = await client.callTool({
    name: "nourish_daily_summary",
    arguments: {},
  });
  const summaryNoComparePayload = JSON.parse(textOf(summaryNoCompare));
  assert.equal(summaryNoComparePayload.comparison, undefined);

  // compare_to: "7d_avg"
  const summary7d = await client.callTool({
    name: "nourish_daily_summary",
    arguments: { compare_to: "7d_avg" },
  });
  const summary7dPayload = JSON.parse(textOf(summary7d));
  assert.equal(summary7dPayload.comparison?.kind, "7d_avg");
  assert.ok(summary7dPayload.comparison.baseline_window?.from);
  assert.ok(summary7dPayload.comparison.baseline_window?.to);

  // === compare_days direct ===
  const today = new Date().toISOString().slice(0, 10);
  const cmp = await client.callTool({
    name: "nourish_compare_days",
    arguments: { date_a: yesterdayDate, date_b: today },
  });
  const cmpPayload = JSON.parse(textOf(cmp));
  assert.notEqual(cmp.isError, true);
  assert.equal(cmpPayload.date_a, yesterdayDate);
  assert.equal(cmpPayload.date_b, today);
  assert.ok(typeof cmpPayload.totals_a === "object");
  assert.ok(typeof cmpPayload.totals_b === "object");
  assert.ok(typeof cmpPayload.deltas === "object");
  assert.equal(typeof cmpPayload.entry_count_delta, "number");

  console.log("ux tools smoke ok");
} finally {
  await client.close();
}
