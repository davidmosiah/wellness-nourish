import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

const localDir = await mkdtemp(join(tmpdir(), "nourish-summary-"));
process.env.NOURISH_LOCAL_DIR = localDir;

try {
  const { addIntakeEntry } = await import("../dist/services/intake-store.js");
  const { buildDailySummary } = await import("../dist/services/summary.js");

  await addIntakeEntry({
    timestamp: "2026-05-05T10:00:00.000Z",
    meal_type: "breakfast",
    quantity: 100,
    unit: "g",
    nutrients: { calories_kcal: 89, protein_g: 1 },
    confidence: 0.9,
    source_trace: "manual",
    tags: [],
    wellness_context_refs: [],
  });

  const summary = await buildDailySummary("2026-05-05");

  assert.equal(summary.date, "2026-05-05");
  assert.equal(summary.entry_count, 1);
  assert.equal(summary.total_nutrients.calories_kcal, 89);
  assert.equal(summary.by_meal.breakfast.calories_kcal, 89);

  console.log("summary tests ok");
} finally {
  await rm(localDir, { recursive: true, force: true });
}
