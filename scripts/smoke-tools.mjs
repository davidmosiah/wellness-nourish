import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

const expectedTools = [
  "nourish_agent_manifest",
  "nourish_capabilities",
  "nourish_connection_status",
  "nourish_privacy_audit",
  "nourish_search_food",
  "nourish_lookup_barcode",
  "nourish_decode_barcode_image",
  "nourish_lookup_barcode_image",
  "nourish_get_food",
  "nourish_estimate_meal",
  "nourish_estimate_meal_photo",
  "nourish_log_intake",
  "nourish_list_intake",
  "nourish_update_intake",
  "nourish_delete_intake",
  "nourish_clear_day",
  "nourish_log_water",
  "nourish_hydration_summary",
  "nourish_get_goals",
  "nourish_set_goals",
  "nourish_daily_summary",
  "nourish_weekly_summary",
  "nourish_export_data",
];
const fixtureDir = resolve("fixtures");
const localDir = mkdtempSync(`${tmpdir()}/nourish-smoke-tools-`);
const client = new Client(
  {
    name: "nourish-smoke-tools",
    version: "0.1.0",
  },
  {
    capabilities: {},
  },
);
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
  },
});

try {
  await client.connect(transport);
  const result = await client.listTools();
  const toolNames = result.tools.map((tool) => tool.name);
  const missingTools = expectedTools.filter((toolName) => !toolNames.includes(toolName));

  assert.deepEqual(missingTools, [], `Missing tools: ${missingTools.join(", ")}`);
  assertInitializeInstructions();
  assertSearchSchemaHonest(result.tools);
  assertBarcodeSchemaHonest(result.tools);
  assertSchemaDx(result.tools);
  await assertResourceSurface();
  await assertConfirmationGuardsAreUserActionRequired();
  await assertValidationErrorsAreStructured();
  await assertSdkVisibleValidationErrorsAreStructured();
  await assertMealTextAliasWorks();
  await assertFoodRefLogResolvesProviderNutrients();
  await assertUpdateQuantityRescalesNutrients();

} finally {
  await client.close();
}

console.log("stdio tool smoke ok");

async function assertConfirmationGuardsAreUserActionRequired() {
  for (const call of [
    {
      name: "nourish_log_intake",
      arguments: {
        text: "TESTE QA - 1 banana",
      },
    },
    {
      name: "nourish_log_intake",
      arguments: {
        meal_text: "TESTE QA - 1 banana",
      },
    },
    {
      name: "nourish_log_water",
      arguments: {
        amount_ml: 250,
      },
    },
    {
      name: "nourish_set_goals",
      arguments: {
        hydration_ml: 2500,
      },
    },
    {
      name: "nourish_set_goals",
      arguments: {
        calories_kcal: 2200,
      },
    },
  ]) {
    const result = await client.callTool(call);
    assert.notEqual(result.isError, true, `${call.name} confirmation guard should not mark transport/server error`);
    const payload = JSON.parse(textFromToolResult(result));
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, "USER_ACTION_REQUIRED");
    assert.match(payload.error.message, /explicit_user_intent/i);
  }
}

function assertInitializeInstructions() {
  const instructions = client.getInstructions() ?? "";

  assert.ok(instructions.length > 300);
  assert.match(instructions, /nourish_agent_manifest/);
  assert.match(instructions, /explicit_user_intent/);
  assert.match(instructions, /unresolved/i);
}

function assertSchemaDx(tools) {
  const logIntake = findTool(tools, "nourish_log_intake");
  const logWater = findTool(tools, "nourish_log_water");
  const setGoals = findTool(tools, "nourish_set_goals");

  assert.match(logIntake.inputSchema?.properties?.text?.description ?? "", /meal text/i);
  assert.match(logIntake.inputSchema?.properties?.meal_text?.description ?? "", /alias/i);
  assert.match(logIntake.inputSchema?.properties?.explicit_user_intent?.description ?? "", /Pass true/i);
  assert.match(logWater.inputSchema?.properties?.explicit_user_intent?.description ?? "", /Pass true/i);
  assert.match(setGoals.inputSchema?.properties?.daily?.description ?? "", /nested/i);
  assert.match(setGoals.inputSchema?.properties?.calories_kcal?.description ?? "", /flat/i);
}

async function assertValidationErrorsAreStructured() {
  const result = await client.callTool({
    name: "nourish_log_intake",
    arguments: {
      explicit_user_intent: true,
    },
  });
  const payload = JSON.parse(textFromToolResult(result));

  assert.equal(result.isError, true);
  assert.equal(payload.error.code, "VALIDATION_ERROR");
  assert.ok(Array.isArray(payload.error.errors));
  assert.ok(payload.error.errors.some((entry) => entry.path === "text"));
}

async function assertSdkVisibleValidationErrorsAreStructured() {
  for (const call of [
    {
      name: "nourish_log_water",
      arguments: {
        amount_ml: -100,
        explicit_user_intent: true,
      },
      path: "amount_ml",
    },
    {
      name: "nourish_lookup_barcode",
      arguments: {
        barcode: "123",
      },
      path: "barcode",
    },
  ]) {
    const result = await client.callTool(call);
    const payload = JSON.parse(textFromToolResult(result));

    assert.equal(result.isError, true);
    assert.equal(payload.error.code, "VALIDATION_ERROR");
    assert.ok(payload.error.errors.some((entry) => entry.path === call.path));
  }
}

async function assertMealTextAliasWorks() {
  const result = await client.callTool({
    name: "nourish_estimate_meal",
    arguments: {
      meal_text: "banana",
      meal_type: "snack",
    },
  });
  const payload = JSON.parse(textFromToolResult(result));

  assert.equal(result.isError, undefined);
  assert.equal(payload.items[0].name, "banana");
}

async function assertFoodRefLogResolvesProviderNutrients() {
  const result = await client.callTool({
    name: "nourish_log_intake",
    arguments: {
      explicit_user_intent: true,
      food_ref: {
        source: "usda",
        source_id: "173944",
        name: "Bananas, raw",
      },
      quantity: 1,
      unit: "serving",
      grams_estimate: 118,
    },
  });
  const payload = JSON.parse(textFromToolResult(result));

  assert.equal(result.isError, undefined);
  assert.equal(payload.food_ref.name, "Bananas, raw");
  assert.equal(payload.grams_estimate, 118);
  assert.equal(payload.nutrients.calories_kcal, 105.02);
  assert.equal(payload.source_trace, "exact_food");
}

async function assertUpdateQuantityRescalesNutrients() {
  const log = await client.callTool({
    name: "nourish_log_intake",
    arguments: {
      explicit_user_intent: true,
      text: "100g arroz branco",
      meal_type: "lunch",
    },
  });
  const entry = JSON.parse(textFromToolResult(log));

  assert.equal(entry.nutrients.calories_kcal, 130);
  assert.equal(entry.grams_estimate, 100);

  const updated = await client.callTool({
    name: "nourish_update_intake",
    arguments: {
      id: entry.id,
      quantity: 2,
    },
  });
  const payload = JSON.parse(textFromToolResult(updated));

  assert.equal(payload.quantity, 2);
  assert.equal(payload.grams_estimate, 200);
  assert.equal(payload.nutrients.calories_kcal, 260);
}

function assertSearchSchemaHonest(tools) {
  const searchTool = findTool(tools, "nourish_search_food");
  const provider = searchTool.inputSchema?.properties?.provider;

  if (provider !== undefined) {
    assert.deepEqual(provider.enum, ["usda"]);
  }
}

function assertBarcodeSchemaHonest(tools) {
  const barcodeTool = findTool(tools, "nourish_lookup_barcode");

  assert.equal(
    Object.hasOwn(barcodeTool.inputSchema?.properties ?? {}, "fallback_search"),
    false,
  );
}

async function assertResourceSurface() {
  const resources = await client.listResources();
  const uris = resources.resources.map((resource) => resource.uri);

  assert.ok(uris.includes("nourish://usage-guide"));
  const guide = await client.readResource({ uri: "nourish://usage-guide" });
  assert.match(guide.contents[0]?.text ?? "", /preview/i);
  assert.match(guide.contents[0]?.text ?? "", /explicit user intent/i);
}

function findTool(tools, name) {
  const tool = tools.find((entry) => entry.name === name);

  assert.ok(tool, `Missing tool ${name}`);
  return tool;
}

function textFromToolResult(result) {
  return result.content
    .filter((entry) => entry.type === "text")
    .map((entry) => entry.text)
    .join("\n");
}
