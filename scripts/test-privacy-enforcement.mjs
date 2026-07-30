import assert from "node:assert/strict";
import {
  redactIntakeEntryForPrivacy,
  redactSummaryForPrivacy,
  resolvePrivacyMode,
} from "../dist/services/privacy.js";

assert.equal(resolvePrivacyMode(undefined), "structured");
assert.equal(resolvePrivacyMode("summary"), "summary");

const entry = {
  id: "1",
  date: "2026-07-30",
  timestamp: "2026-07-30T12:00:00Z",
  meal_type: "lunch",
  confidence: 0.9,
  source_trace: "estimate",
  tags: ["br"],
  nutrients: { calories_kcal: 500, protein_g: 30 },
  text: "200g arroz e frango",
  notes: "secret food preference",
  items: [{ name: "arroz" }],
};
const red = redactIntakeEntryForPrivacy(entry, "summary");
assert.equal(red.redacted, true);
assert.equal(red.text, undefined);
assert.equal(red.notes, undefined);
assert.equal(red.items, undefined);
assert.equal(red.nutrients.calories_kcal, 500);
assert.equal(redactIntakeEntryForPrivacy(entry, "structured").text, "200g arroz e frango");

const sum = redactSummaryForPrivacy(
  { date: "2026-07-30", entry_count: 2, total_nutrients: { protein_g: 40 }, entries: [entry] },
  "summary",
);
assert.equal(sum.redacted, true);
assert.equal(sum.entries, undefined);
assert.equal(sum.entry_count, 2);

console.log(JSON.stringify({ ok: true, suite: "privacy-enforcement" }, null, 2));
