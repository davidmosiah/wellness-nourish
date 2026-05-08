import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

const localDir = await mkdtemp(join(tmpdir(), "nourish-hydration-goals-"));
process.env.NOURISH_LOCAL_DIR = localDir;
// Pin to UTC so the date-bucket assertions (e.g. "2026-05-05") stay
// timezone-independent. See comment in test-intake-store.mjs.
process.env.NOURISH_TIMEZONE = "UTC";

try {
  const { logWater, buildHydrationSummary } = await import("../dist/services/hydration-store.js");
  const { getGoals, updateGoals } = await import("../dist/services/goals-store.js");

  const goals = await updateGoals({
    daily: {
      calories_kcal: 2100,
      protein_g: 130,
    },
    hydration_ml: 2800,
  });

  assert.equal(goals.daily.calories_kcal, 2100);
  assert.equal(goals.daily.protein_g, 130);
  assert.equal(goals.hydration_ml, 2800);
  assert.ok(goals.updated_at);
  assert.deepEqual(await getGoals(), goals);

  const entry = await logWater({
    timestamp: "2026-05-05T15:00:00.000Z",
    amount_ml: 750,
    notes: "bottle",
  });

  assert.match(entry.id, /^water_/);
  assert.equal(entry.date, "2026-05-05");
  assert.equal(entry.amount_ml, 750);

  const summary = await buildHydrationSummary("2026-05-05");
  assert.equal(summary.date, "2026-05-05");
  assert.equal(summary.total_ml, 750);
  assert.equal(summary.goal_ml, 2800);
  assert.equal(summary.progress_percent, 26.79);

  console.log("hydration and goals tests ok");
} finally {
  await rm(localDir, { recursive: true, force: true });
}
