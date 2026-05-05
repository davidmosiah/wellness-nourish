import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

const env = {
  ...process.env,
  NOURISH_FIXTURE_MODE: "1",
  NOURISH_FIXTURE_DIR: resolve("fixtures"),
  NOURISH_LOCAL_DIR: mkdtempSync(`${tmpdir()}/nourish-cli-ux-`),
};

const status = run(["status"]);
assert.match(status, /Nourish MCP/);
assert.match(status, /open_food_facts_enabled/);

const search = run(["search", "banana"]);
assert.match(search, /Bananas, raw/);
assert.match(search, /usda/);

const version = run(["--version"]);
assert.match(version, /nourish-mcp 0\.1\.3/);

const help = run(["--help"]);
assert.match(help, /usage/i);
assert.match(help, /doctor/);
assert.match(help, /weekly/);

const doctor = run(["doctor"]);
assert.match(doctor, /storage/i);
assert.match(doctor, /mcp/i);

const setup = run(["setup", "--client", "claude"]);
assert.match(setup, /"mcpServers"/);
assert.match(setup, /wellness-nourish/);

const preview = JSON.parse(run(["log", "--preview", "--meal", "breakfast", "--timestamp", "2026-05-05T08:00:00.000Z", "2 eggs and banana"]));
assert.equal(preview.would_write, false);
assert.equal(preview.estimate.meal_type, "breakfast");
assert.equal(preview.estimate.items.length, 2);

const logged = JSON.parse(run(["log", "--meal", "breakfast", "--timestamp", "2026-05-05T08:00:00.000Z", "2 eggs and banana"]));
assert.match(logged.id, /^intake_/);
assert.equal(logged.meal_type, "breakfast");

const list = run(["list", "2026-05-05"]);
assert.match(list, new RegExp(logged.id));
assert.match(list, /breakfast/);

const edited = JSON.parse(run(["edit", "--entry", logged.id, "--meal", "snack", "--quantity", "2", "--notes", "late snack"]));
assert.equal(edited.meal_type, "snack");
assert.equal(edited.quantity, 2);
assert.equal(edited.notes, "late snack");

const dailyMarkdown = run(["today", "--date", "2026-05-05", "--format", "markdown"]);
assert.match(dailyMarkdown, /# Nourish Daily Summary/);
assert.match(dailyMarkdown, /calories_kcal/);

const weeklyMarkdown = run(["weekly", "--start-date", "2026-05-05", "--format", "markdown"]);
assert.match(weeklyMarkdown, /# Nourish Weekly Summary/);
assert.match(weeklyMarkdown, /2026-05-05/);

const csv = run(["export", "--format", "csv"]);
assert.match(csv, /^id,timestamp,date,meal_type,/);
assert.match(csv, new RegExp(logged.id));

const goals = JSON.parse(run(["goals", "--set-calories", "2200", "--set-protein", "120", "--set-water", "2500"]));
assert.equal(goals.daily.calories_kcal, 2200);
assert.equal(goals.daily.protein_g, 120);
assert.equal(goals.hydration_ml, 2500);

const water = JSON.parse(run(["water", "500", "--date", "2026-05-05"]));
assert.match(water.id, /^water_/);
assert.equal(water.amount_ml, 500);

const waterSummary = JSON.parse(run(["water", "today", "--date", "2026-05-05"]));
assert.equal(waterSummary.total_ml, 500);
assert.equal(waterSummary.goal_ml, 2500);

const cleared = JSON.parse(run(["clear-day", "2026-05-05", "--yes"]));
assert.equal(cleared.date, "2026-05-05");
assert.equal(cleared.deleted_entries, 1);

console.log("cli ux ok");

function run(args) {
  return execFileSync(process.execPath, ["dist/index.js", ...args], {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
  });
}
