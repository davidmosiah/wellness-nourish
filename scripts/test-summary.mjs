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
  const { logWater } = await import("../dist/services/hydration-store.js");
  const { updateGoals } = await import("../dist/services/goals-store.js");
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
  await logWater({
    timestamp: "2026-05-05T12:00:00.000Z",
    amount_ml: 500,
  });
  await updateGoals({
    daily: {
      calories_kcal: 2000,
      protein_g: 120,
    },
    hydration_ml: 2500,
  });

  const summary = await buildDailySummary("2026-05-05");

  assert.equal(summary.date, "2026-05-05");
  assert.equal(summary.entry_count, 1);
  assert.equal(summary.total_nutrients.calories_kcal, 89);
  assert.equal(summary.by_meal.breakfast.calories_kcal, 89);
  assert.equal(summary.hydration.total_ml, 500);
  assert.equal(summary.goal_progress.calories_kcal.percent, 4.45);
  assert.equal(summary.goal_progress.hydration_ml.percent, 20);

  console.log("summary tests ok");
} finally {
  await rm(localDir, { recursive: true, force: true });
}
