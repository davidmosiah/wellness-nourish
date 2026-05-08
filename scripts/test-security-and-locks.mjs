// Regression tests for the security + integrity fixes in PR #11:
//   A2 — mutation lock for goals + personal-memory (lost-update guard)
//   B3 — image_path traversal validation
//   C2 — coach pt-BR strings localized for en-US
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

const localDir = await mkdtemp(join(tmpdir(), "nourish-security-"));
process.env.NOURISH_LOCAL_DIR = localDir;
process.env.NOURISH_TIMEZONE = "UTC";

try {
  // --- A2: parallel updateGoals must NOT lose updates ---
  const { updateGoals, getGoals } = await import("../dist/services/goals-store.js");

  // Two parallel updates touching different keys. Without the lock, the
  // second write would clobber the first.
  await Promise.all([
    updateGoals({ daily: { calories_kcal: 2200 } }),
    updateGoals({ daily: { protein_g: 150 } }),
  ]);
  const merged = await getGoals();
  assert.equal(merged.daily.calories_kcal, 2200, "A2: parallel calories update must not be lost");
  assert.equal(merged.daily.protein_g, 150, "A2: parallel protein update must not be lost");

  // 10 parallel hydration_ml updates — last wins, but no exception/corruption.
  await Promise.all(
    [...Array(10)].map((_, index) => updateGoals({ hydration_ml: 2000 + index * 100 })),
  );
  const after = await getGoals();
  assert.ok(typeof after.hydration_ml === "number" && after.hydration_ml >= 2000);
  assert.equal(after.daily.calories_kcal, 2200, "A2: previous goals preserved across stress");
  assert.equal(after.daily.protein_g, 150);

  // --- A2: parallel rememberMeal must NOT lose entries ---
  const { rememberMeal, getPersonalNutritionMemory } = await import("../dist/services/personal-memory.js");
  await Promise.all([
    rememberMeal({ label: "cafe da manha", meal_text: "2 ovos e 1 banana" }),
    rememberMeal({ label: "almoco padrao", meal_text: "arroz, feijao, frango" }),
    rememberMeal({ label: "lanche tarde", meal_text: "iogurte e granola" }),
    rememberMeal({ label: "janta leve", meal_text: "salada e atum" }),
    rememberMeal({ label: "pre treino", meal_text: "banana e cafezinho" }),
  ]);
  const memory = await getPersonalNutritionMemory();
  assert.equal(memory.remembered_meals.length, 5, "A2: parallel rememberMeal must keep all 5");

  // --- B3: image_path must reject paths outside allowed roots ---
  const { decodeBarcodeImage } = await import("../dist/services/image-decoder.js");
  await assert.rejects(
    () => decodeBarcodeImage({ image_path: "/etc/passwd" }),
    /image_path must resolve to a file under/,
    "B3: arbitrary system paths must be rejected",
  );
  await assert.rejects(
    () => decodeBarcodeImage({ image_path: "/etc/../etc/passwd" }),
    /image_path must resolve to a file under/,
    "B3: traversal via .. must be rejected (resolved path is still /etc/passwd)",
  );
  await assert.rejects(
    () => decodeBarcodeImage({ image_path: "~/../../../../etc/shadow" }),
    /image_path must resolve to a file under/,
    "B3: home-relative traversal must be rejected",
  );

  const symlinkPath = join(localDir, "passwd-link.png");
  await symlink("/etc/passwd", symlinkPath);
  await assert.rejects(
    () => decodeBarcodeImage({ image_path: symlinkPath }),
    /image_path must resolve to a file under/,
    "B3: symlinks inside allowed roots must not escape to arbitrary files",
  );

  // Path under tmpdir IS allowed (file may not exist; we want past the
  // safety check and into the read).
  await assert.rejects(
    () => decodeBarcodeImage({ image_path: join(tmpdir(), "nourish-test-nonexistent.png") }),
    /ENOENT|no such file/,
    "B3: paths under tmpdir are allowed (will fail later on missing file)",
  );

  // --- C2: coach suggestion text honors locale ---
  const { buildNutritionCoach } = await import("../dist/services/coach.js");
  const ptCoach = await buildNutritionCoach({
    mode: "pre_workout_nutrition",
    date: "2024-01-01",
    locale: "pt-BR",
  });
  assert.match(ptCoach.suggested_next_meal?.text ?? "", /banana|tapioca|caf/i, "C2: pt-BR pre-workout suggestion in Portuguese");

  const enCoach = await buildNutritionCoach({
    mode: "pre_workout_nutrition",
    date: "2024-01-01",
    locale: "en-US",
  });
  assert.match(enCoach.suggested_next_meal?.text ?? "", /oats|black coffee|banana/i, "C2: en-US pre-workout suggestion in English");
  assert.doesNotMatch(enCoach.suggested_next_meal?.text ?? "", /tapioca|cafezinho/i, "C2: en-US must NOT include pt-BR-only words");

  // Unknown locale falls back to en-US (safer default for global agents).
  const frCoach = await buildNutritionCoach({
    mode: "pre_workout_nutrition",
    date: "2024-01-01",
    locale: "fr-FR",
  });
  assert.match(frCoach.suggested_next_meal?.text ?? "", /oats|black coffee|banana/i, "C2: unknown locale falls back to en-US");

  console.log("security + locks tests ok");
} finally {
  await rm(localDir, { recursive: true, force: true });
}
