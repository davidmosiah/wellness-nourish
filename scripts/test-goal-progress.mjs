import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

const localDir = await mkdtemp(join(tmpdir(), "nourish-goal-progress-"));
process.env.NOURISH_LOCAL_DIR = localDir;
// Pin to UTC so date-bucket assertions stay timezone-independent.
process.env.NOURISH_TIMEZONE = "UTC";

try {
  const { updateGoals } = await import("../dist/services/goals-store.js");
  const { addIntakeEntry } = await import("../dist/services/intake-store.js");
  const { logWater } = await import("../dist/services/hydration-store.js");
  const { buildGoalProgress } = await import("../dist/services/goal-progress.js");
  const { localDate } = await import("../dist/services/local-date.js");

  // 1. Empty period with no goals returns an empty progress with hint recommendation.
  {
    const empty = await buildGoalProgress("today");
    assert.equal(empty.period, "today");
    assert.equal(empty.days.length, 1);
    assert.equal(empty.days[0].kcal.consumed, 0);
    assert.equal(empty.days[0].kcal.goal, 0);
    assert.equal(empty.goals_snapshot.kcal, 0);
    assert.ok(empty.recommendations.length >= 1, "should emit a 'set goals' recommendation when none configured");
    assert.match(empty.recommendations[0], /nourish_set_goals/i);
  }

  // 2. Configure goals and log intake — today should show progress.
  await updateGoals({
    daily: {
      calories_kcal: 2100,
      protein_g: 130,
      carbohydrates_g: 240,
      fat_g: 70,
    },
    hydration_ml: 2800,
  });

  const today = localDate();
  const nowIso = `${today}T12:00:00.000Z`;

  await addIntakeEntry({
    meal_type: "breakfast",
    quantity: 1,
    unit: "serving",
    custom_food: {
      source: "manual",
      source_id: "test-breakfast",
      name: "Test breakfast",
      nutrients_per_100g: {
        calories_kcal: 1050,
        protein_g: 65,
        carbohydrates_g: 120,
        fat_g: 35,
      },
    },
    nutrients: {
      calories_kcal: 1050,
      protein_g: 65,
      carbohydrates_g: 120,
      fat_g: 35,
    },
    grams_estimate: 100,
    confidence: 1,
    source_trace: "manual",
    timestamp: nowIso,
  });

  await logWater({ timestamp: nowIso, amount_ml: 1400 });

  const todayProgress = await buildGoalProgress("today");
  assert.equal(todayProgress.days.length, 1);
  assert.equal(todayProgress.days[0].kcal.consumed, 1050);
  assert.equal(todayProgress.days[0].kcal.goal, 2100);
  assert.equal(todayProgress.days[0].kcal.pct, 50);
  assert.equal(todayProgress.days[0].kcal.delta_to_goal, -1050);
  assert.equal(todayProgress.days[0].protein_g.consumed, 65);
  assert.equal(todayProgress.days[0].protein_g.pct, 50);
  assert.equal(todayProgress.days[0].water_ml.consumed, 1400);
  assert.equal(todayProgress.days[0].water_ml.goal, 2800);
  assert.equal(todayProgress.days[0].water_ml.pct, 50);
  assert.equal(todayProgress.days[0].on_target, false, "50% of goal is not on-target");
  assert.equal(todayProgress.goals_snapshot.kcal, 2100);
  assert.equal(todayProgress.goals_snapshot.water_ml, 2800);
  assert.equal(todayProgress.days_with_data, 1);
  assert.equal(todayProgress.days_on_target, 0);
  assert.ok(Array.isArray(todayProgress.recommendations));
  assert.ok(todayProgress.recommendations.length >= 1, "should emit at least one recommendation");

  // 3. last_7_days returns 7 day entries + averages + totals.
  const weekProgress = await buildGoalProgress("last_7_days");
  assert.equal(weekProgress.days.length, 7);
  assert.equal(weekProgress.totals.kcal_consumed, 1050);
  assert.equal(weekProgress.totals.water_ml_consumed, 1400);
  assert.ok(weekProgress.averages, "last_7_days should include averages");
  assert.equal(weekProgress.averages.kcal_per_day, 1050, "average over 1 active day");

  // 4. last_30_days returns 30 day entries.
  const monthProgress = await buildGoalProgress("last_30_days");
  assert.equal(monthProgress.days.length, 30);

  // 5. yesterday returns 1 day, no intake.
  const yesterdayProgress = await buildGoalProgress("yesterday");
  assert.equal(yesterdayProgress.days.length, 1);
  assert.equal(yesterdayProgress.days[0].kcal.consumed, 0);
  assert.equal(yesterdayProgress.days[0].entry_count, 0);

  // 6. Period totals are correct: log more for "today" and reverify.
  await addIntakeEntry({
    meal_type: "lunch",
    quantity: 1,
    unit: "serving",
    custom_food: {
      source: "manual",
      source_id: "test-lunch",
      name: "Test lunch",
      nutrients_per_100g: {
        calories_kcal: 1050,
        protein_g: 65,
        carbohydrates_g: 120,
        fat_g: 35,
      },
    },
    nutrients: {
      calories_kcal: 1050,
      protein_g: 65,
      carbohydrates_g: 120,
      fat_g: 35,
    },
    grams_estimate: 100,
    confidence: 1,
    source_trace: "manual",
    timestamp: nowIso,
  });
  await logWater({ timestamp: nowIso, amount_ml: 1400 });

  const onTargetProgress = await buildGoalProgress("today");
  assert.equal(onTargetProgress.days[0].kcal.consumed, 2100);
  assert.equal(onTargetProgress.days[0].kcal.pct, 100);
  assert.equal(onTargetProgress.days[0].water_ml.consumed, 2800);
  assert.equal(onTargetProgress.days[0].water_ml.pct, 100);
  assert.equal(onTargetProgress.days[0].on_target, true, "100% of every macro goal should be on-target");
  assert.equal(onTargetProgress.days_on_target, 1);

  console.log("goal-progress tests ok");
} finally {
  await rm(localDir, { recursive: true, force: true });
}
