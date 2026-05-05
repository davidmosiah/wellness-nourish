import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

const localDir = await mkdtemp(join(tmpdir(), "nourish-intake-store-"));
process.env.NOURISH_LOCAL_DIR = localDir;

try {
  const {
    addIntakeEntry,
    updateIntakeEntry,
    listIntakeEntries,
    deleteIntakeEntry,
    exportIntakeData,
  } = await import("../dist/services/intake-store.js");

  const entry = await addIntakeEntry({
    meal_type: "breakfast",
    quantity: 100,
    unit: "g",
    nutrients: { calories_kcal: 89, protein_g: 1.09 },
    confidence: 0.9,
    source_trace: "manual",
    tags: ["fixture"],
    wellness_context_refs: [],
  });

  assert.equal(entry.meal_type, "breakfast");
  assert.match(entry.id, /^intake_/);

  const entries = await listIntakeEntries({ date: entry.date });
  assert.equal(entries.length, 1);

  const updated = await updateIntakeEntry(entry.id, {
    meal_type: "snack",
    quantity: 125,
    notes: "updated fixture",
  });
  assert.equal(updated.meal_type, "snack");
  assert.equal(updated.quantity, 125);
  assert.equal(updated.notes, "updated fixture");

  const exported = await exportIntakeData();
  assert.match(exported, /snack/);

  assert.equal(await deleteIntakeEntry("missing-intake-id"), false);
  assert.equal(await deleteIntakeEntry(entry.id), true);
  assert.equal((await listIntakeEntries({ date: entry.date })).length, 0);

  console.log("intake store tests ok");
} finally {
  await rm(localDir, { recursive: true, force: true });
}
