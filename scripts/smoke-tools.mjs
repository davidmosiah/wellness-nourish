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
  "nourish_analyze_food_image",
  "nourish_log_intake",
  "nourish_daily_coach",
  "nourish_suggest_next_meal",
  "nourish_after_log_review",
  "nourish_pre_workout_nutrition",
  "nourish_evening_checkin",
  "nourish_remember_meal",
  "nourish_list_memory",
  "nourish_forget_memory",
  "nourish_list_intake",
  "nourish_update_intake",
  "nourish_delete_intake",
  "nourish_clear_day",
  "nourish_undo_last",
  "nourish_log_water",
  "nourish_delete_water",
  "nourish_clear_hydration_day",
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
    // Pin to UTC so date-bucket assertions ("2099-01-15", etc.) stay
    // timezone-independent on contributor machines.
    NOURISH_TIMEZONE: "UTC",
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
  await assertBrazilianLocalSearchWorks();
  await assertPersonalMemoryFeedsEstimator();
  await assertCoachLoopReadsGoalsAndWearableContext();
  await assertFoodImageRouterSupportsBarcodeMealAndLabel();
  await assertExplicitNutrientsBeatText();
  await assertCustomFoodScalesByGrams();
  await assertHydrationDeleteAndClear();
  await assertConnectionStatusEnriched();
  await assertAgentManifestIncludesHydrationTools();
  await assertLabelOcrWithoutNutrientsDoesNotSuggestLog();
  await assertParallelAllProviderTagsWarnings();
  await assertConnectionStatusExposesTimezone();
  await assertUndoLastWorks();

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
  const dailyCoach = findTool(tools, "nourish_daily_coach");

  assert.match(logIntake.inputSchema?.properties?.text?.description ?? "", /meal text/i);
  assert.match(logIntake.inputSchema?.properties?.meal_text?.description ?? "", /alias/i);
  assert.match(logIntake.inputSchema?.properties?.explicit_user_intent?.description ?? "", /Pass true/i);
  assert.match(logWater.inputSchema?.properties?.explicit_user_intent?.description ?? "", /Pass true/i);
  assert.match(setGoals.inputSchema?.properties?.daily?.description ?? "", /nested/i);
  assert.match(setGoals.inputSchema?.properties?.calories_kcal?.description ?? "", /flat/i);
  assert.match(dailyCoach.description ?? "", /coach/i);
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

async function assertBrazilianLocalSearchWorks() {
  const result = await client.callTool({
    name: "nourish_search_food",
    arguments: {
      query: "picanha",
      provider: "br_local",
      limit: 5,
    },
  });
  const payload = JSON.parse(textFromToolResult(result));

  assert.equal(result.isError, undefined);
  assert.equal(payload.provider, "br_local");
  assert.ok(payload.foods.some((food) => food.name === "picanha"));
  assert.ok(payload.foods[0].license.attribution.includes("Nourish"));
}

async function assertPersonalMemoryFeedsEstimator() {
  const guarded = await client.callTool({
    name: "nourish_remember_meal",
    arguments: {
      label: "meu cafe normal",
      meal_text: "2 ovos cozidos e 1 banana",
    },
  });
  const guardedPayload = JSON.parse(textFromToolResult(guarded));

  assert.equal(guarded.isError, undefined);
  assert.equal(guardedPayload.error.code, "USER_ACTION_REQUIRED");

  const remembered = await client.callTool({
    name: "nourish_remember_meal",
    arguments: {
      explicit_user_intent: true,
      label: "meu cafe normal",
      aliases: ["cafe padrao"],
      meal_text: "2 ovos cozidos e 1 banana",
      default_meal_type: "breakfast",
    },
  });
  const rememberedPayload = JSON.parse(textFromToolResult(remembered));

  assert.equal(remembered.isError, undefined);
  assert.equal(rememberedPayload.ok, true);
  assert.equal(rememberedPayload.meal.label, "meu cafe normal");

  const estimate = await client.callTool({
    name: "nourish_estimate_meal",
    arguments: {
      text: "meu cafe normal",
      locale: "pt-BR",
    },
  });
  const estimatePayload = JSON.parse(textFromToolResult(estimate));

  assert.equal(estimate.isError, undefined);
  assert.deepEqual(estimatePayload.personal_memory.matches.map((match) => match.label), ["meu cafe normal"]);
  assert.ok((estimatePayload.total_nutrients.protein_g ?? 0) > 10);
  assert.equal(estimatePayload.unresolved.length, 0);

  const memory = await client.callTool({
    name: "nourish_list_memory",
    arguments: {},
  });
  const memoryPayload = JSON.parse(textFromToolResult(memory));

  assert.ok(memoryPayload.remembered_meals.some((meal) => meal.label === "meu cafe normal"));
}

async function assertCoachLoopReadsGoalsAndWearableContext() {
  await client.callTool({
    name: "nourish_set_goals",
    arguments: {
      calories_kcal: 2200,
      protein_g: 140,
      hydration_ml: 2600,
      explicit_user_intent: true,
    },
  });
  const coach = await client.callTool({
    name: "nourish_daily_coach",
    arguments: {
      date: new Date().toISOString().slice(0, 10),
      locale: "pt-BR",
      wearable_context: {
        source: "whoop",
        recovery: "green",
        strain: 12.4,
        sleep_performance: 88,
      },
      focus: "protein",
    },
  });
  const payload = JSON.parse(textFromToolResult(coach));

  assert.equal(coach.isError, undefined);
  assert.equal(payload.mode, "daily_coach");
  assert.equal(payload.requires_confirmation_to_log, true);
  assert.ok(payload.gaps.protein_g.remaining >= 0);
  assert.ok(payload.wellness_context.sources.includes("whoop"));
  assert.ok(payload.next_actions.length > 0);
}

async function assertFoodImageRouterSupportsBarcodeMealAndLabel() {
  const meal = await client.callTool({
    name: "nourish_analyze_food_image",
    arguments: {
      image_description: "prato com arroz branco, feijão carioca e frango grelhado",
      detected_items: [
        { name: "arroz branco", grams_estimate: 180, confidence: 0.75 },
        { name: "feijão carioca", grams_estimate: 100, confidence: 0.7 },
        { name: "frango grelhado", grams_estimate: 140, confidence: 0.72 },
      ],
      locale: "pt-BR",
      meal_type: "lunch",
    },
  });
  const mealPayload = JSON.parse(textFromToolResult(meal));

  assert.equal(meal.isError, undefined);
  assert.equal(mealPayload.route, "meal_photo");
  assert.equal(mealPayload.requires_confirmation, true);
  assert.ok((mealPayload.meal_estimate.estimate.total_nutrients.protein_g ?? 0) > 40);

  const label = await client.callTool({
    name: "nourish_analyze_food_image",
    arguments: {
      image_description: "rótulo de iogurte",
      product_name: "Iogurte Proteico",
      nutrition_label_text: "Porção 170g Valor energético 120 kcal Carboidratos 8g Proteínas 15g Gorduras totais 2g",
      locale: "pt-BR",
    },
  });
  const labelPayload = JSON.parse(textFromToolResult(label));

  assert.equal(label.isError, undefined);
  assert.equal(labelPayload.route, "nutrition_label");
  assert.equal(labelPayload.label_food.name, "Iogurte Proteico");
  assert.equal(labelPayload.label_food.nutrients_per_serving.protein_g, 15);
  assert.equal(labelPayload.suggested_log_intake.explicit_user_intent, false);
}

// --- N-001: explicit nutrients/custom_food/food_ref must override `text` ---
async function assertExplicitNutrientsBeatText() {
  const result = await client.callTool({
    name: "nourish_log_intake",
    arguments: {
      explicit_user_intent: true,
      text: "QA synthetic protein bar from label",
      nutrients: {
        calories_kcal: 220,
        protein_g: 20,
        carbohydrates_g: 22,
        fat_g: 7,
        sodium_mg: 180,
      },
      quantity: 1,
      unit: "serving",
      meal_type: "snack",
    },
  });
  const payload = JSON.parse(textFromToolResult(result));

  assert.notEqual(result.isError, true, "explicit-nutrients log should not error");
  assert.equal(payload.nutrients.calories_kcal, 220, "calories must come from explicit nutrients, not text estimate");
  assert.equal(payload.nutrients.protein_g, 20);
  assert.equal(payload.nutrients.sodium_mg, 180);
  // Text label should be preserved somewhere visible (food_ref.name OR notes).
  const labelText = "QA synthetic protein bar from label";
  const labelPreserved =
    payload.food_ref?.name === labelText ||
    payload.custom_food?.name === labelText ||
    payload.notes === labelText;
  assert.ok(labelPreserved, `text label '${labelText}' should be preserved in food_ref.name or notes; got food_ref=${JSON.stringify(payload.food_ref)} notes=${payload.notes}`);

  // Cleanup
  await client.callTool({
    name: "nourish_delete_intake",
    arguments: { id: payload.id },
  });
}

// --- N-002: custom_food.nutrients_per_100g must scale by grams_estimate ---
async function assertCustomFoodScalesByGrams() {
  const result = await client.callTool({
    name: "nourish_log_intake",
    arguments: {
      explicit_user_intent: true,
      custom_food: {
        source: "manual",
        source_id: "qa-custom-bar-canonical",
        name: "QA Custom Bar canonical delete_me",
        nutrients_per_100g: {
          calories_kcal: 366.67,
          protein_g: 33.33,
          carbohydrates_g: 36.67,
          fat_g: 11.67,
          sodium_mg: 300,
        },
      },
      grams_estimate: 60,
      quantity: 1,
      unit: "serving",
      meal_type: "snack",
    },
  });
  const payload = JSON.parse(textFromToolResult(result));

  assert.notEqual(result.isError, true, "custom_food log should not error");
  // 60g of 366.67kcal/100g = 220.0 kcal (within rounding).
  assert.ok(
    Math.abs(payload.nutrients.calories_kcal - 220) < 1,
    `60g should scale to ~220 kcal (got ${payload.nutrients.calories_kcal}); per_100g not being scaled`,
  );
  assert.ok(
    Math.abs(payload.nutrients.protein_g - 20) < 0.5,
    `60g should scale to ~20g protein (got ${payload.nutrients.protein_g})`,
  );
  assert.ok(
    Math.abs(payload.nutrients.sodium_mg - 180) < 1,
    `60g should scale to ~180mg sodium (got ${payload.nutrients.sodium_mg})`,
  );

  // Cleanup
  await client.callTool({
    name: "nourish_delete_intake",
    arguments: { id: payload.id },
  });
}

// --- N-003: hydration delete + clear day + clear_day(include_hydration) ---
async function assertHydrationDeleteAndClear() {
  const date = "2099-01-15";

  // Log → confirm summary → delete by id → confirm summary back to 0.
  const log = await client.callTool({
    name: "nourish_log_water",
    arguments: { explicit_user_intent: true, amount_ml: 333, date },
  });
  const logPayload = JSON.parse(textFromToolResult(log));
  assert.notEqual(log.isError, true);
  assert.match(logPayload.id, /^water_/);

  let summary = JSON.parse(
    textFromToolResult(
      await client.callTool({ name: "nourish_hydration_summary", arguments: { date } }),
    ),
  );
  assert.equal(summary.total_ml, 333);

  const del = await client.callTool({
    name: "nourish_delete_water",
    arguments: { explicit_user_intent: true, id: logPayload.id },
  });
  const delPayload = JSON.parse(textFromToolResult(del));
  assert.notEqual(del.isError, true);
  assert.equal(delPayload.deleted, true);

  summary = JSON.parse(
    textFromToolResult(
      await client.callTool({ name: "nourish_hydration_summary", arguments: { date } }),
    ),
  );
  assert.equal(summary.total_ml, 0, "summary should drop to 0 after delete_water");

  // delete_water guard: explicit_user_intent omitted → USER_ACTION_REQUIRED.
  const guarded = await client.callTool({
    name: "nourish_delete_water",
    arguments: { id: "water_does_not_exist" },
  });
  const guardedPayload = JSON.parse(textFromToolResult(guarded));
  assert.equal(guardedPayload.error?.code, "USER_ACTION_REQUIRED");

  // clear_hydration_day: log 2 entries, clear, verify count.
  await client.callTool({
    name: "nourish_log_water",
    arguments: { explicit_user_intent: true, amount_ml: 500, date },
  });
  await client.callTool({
    name: "nourish_log_water",
    arguments: { explicit_user_intent: true, amount_ml: 250, date },
  });
  const clear = await client.callTool({
    name: "nourish_clear_hydration_day",
    arguments: { explicit_user_intent: true, date },
  });
  const clearPayload = JSON.parse(textFromToolResult(clear));
  assert.notEqual(clear.isError, true);
  assert.equal(clearPayload.deleted_entries, 2);

  // clear_day with include_hydration: log water + intake, clear both.
  await client.callTool({
    name: "nourish_log_water",
    arguments: { explicit_user_intent: true, amount_ml: 100, date },
  });
  const intake = await client.callTool({
    name: "nourish_log_intake",
    arguments: {
      explicit_user_intent: true,
      text: "qa-synthetic banana",
      meal_type: "snack",
      timestamp: `${date}T12:00:00.000Z`,
    },
  });
  const intakePayload = JSON.parse(textFromToolResult(intake));
  assert.notEqual(intake.isError, true);

  const clearAll = await client.callTool({
    name: "nourish_clear_day",
    arguments: { explicit_user_intent: true, date, include_hydration: true },
  });
  const clearAllPayload = JSON.parse(textFromToolResult(clearAll));
  assert.notEqual(clearAll.isError, true);
  assert.equal(clearAllPayload.hydration?.deleted_entries, 1);
  assert.ok(clearAllPayload.deleted_entries >= 1, "intake from same date should be cleared too");

  summary = JSON.parse(
    textFromToolResult(
      await client.callTool({ name: "nourish_hydration_summary", arguments: { date } }),
    ),
  );
  assert.equal(summary.total_ml, 0, "all hydration for date should be gone");

  // Defensive cleanup if anything stuck around.
  if (intakePayload?.id !== undefined) {
    await client.callTool({
      name: "nourish_delete_intake",
      arguments: { id: intakePayload.id },
    });
  }
}

// --- Sprint 2: connection_status now exposes warnings + provider_timeout_ms +
//     usda_using_demo_key flag for the shared/rate-limited DEMO_KEY case ---
async function assertConnectionStatusEnriched() {
  const result = await client.callTool({
    name: "nourish_connection_status",
    arguments: {},
  });
  const payload = JSON.parse(textFromToolResult(result));

  assert.notEqual(result.isError, true, "connection_status should not error");
  assert.equal(typeof payload.provider_timeout_ms, "number", "provider_timeout_ms should be a number");
  assert.ok(payload.provider_timeout_ms > 0);
  assert.ok(Array.isArray(payload.warnings), "warnings array must be present");
  assert.equal(typeof payload.usda_using_demo_key, "boolean", "usda_using_demo_key flag must be present");
  assert.equal(payload.usda_using_demo_key, false, "fixture-mode smoke should not flag DEMO_KEY use");
}

// --- Sprint 2 / E1: hydration tools added in PR #7 must surface in the
//     agent-manifest so agents discovering tools at boot know they exist. ---
async function assertAgentManifestIncludesHydrationTools() {
  const result = await client.callTool({
    name: "nourish_agent_manifest",
    arguments: { client: "generic" },
  });
  const payload = JSON.parse(textFromToolResult(result));

  assert.notEqual(result.isError, true);
  assert.ok(Array.isArray(payload.tools), "agent-manifest must include tools[]");
  for (const expected of ["nourish_delete_water", "nourish_clear_hydration_day"]) {
    assert.ok(
      payload.tools.includes(expected),
      `agent-manifest must list ${expected} so discovery doesn't hide it (E1)`,
    );
  }
}

// --- N-009: nutrition-label OCR with no parseable nutrients should emit
//     route: "needs_more_ocr" and OMIT suggested_log_intake. Logging an
//     entry with empty nutrients silently corrupts the daily summary. ---
async function assertLabelOcrWithoutNutrientsDoesNotSuggestLog() {
  const result = await client.callTool({
    name: "nourish_analyze_food_image",
    arguments: {
      image_description: "rótulo borrado, ilegível",
      product_name: "Mystery Snack",
      nutrition_label_text: "lorem ipsum dolor sit amet, consectetur adipiscing elit",
      locale: "en-US",
    },
  });
  const payload = JSON.parse(textFromToolResult(result));

  assert.notEqual(result.isError, true);
  assert.equal(payload.route, "needs_more_ocr", `expected needs_more_ocr route, got ${payload.route}`);
  assert.equal(
    payload.suggested_log_intake,
    undefined,
    "must NOT emit suggested_log_intake when label nutrients are empty",
  );
  assert.ok(Array.isArray(payload.warnings) && payload.warnings.length > 0);
}

// --- Sprint 2: `provider: "all"` now fans out via Promise.allSettled and
//     tags every warning with its provider name so a partial failure is
//     attributable. ---
async function assertParallelAllProviderTagsWarnings() {
  const result = await client.callTool({
    name: "nourish_search_food",
    arguments: { query: "banana", provider: "all", limit: 5 },
  });
  const payload = JSON.parse(textFromToolResult(result));

  assert.notEqual(result.isError, true);
  assert.equal(payload.provider, "all");
  if (Array.isArray(payload.warnings) && payload.warnings.length > 0) {
    for (const warning of payload.warnings) {
      assert.match(
        warning,
        /^(br_local|open_food_facts|usda):\s/,
        `warning must be tagged with provider name; got: ${warning}`,
      );
    }
  }
}

// --- Sprint 3 / A1: connection_status now exposes the active timezone so
//     agents can sanity-check date bucketing. ---
async function assertConnectionStatusExposesTimezone() {
  const result = await client.callTool({
    name: "nourish_connection_status",
    arguments: {},
  });
  const payload = JSON.parse(textFromToolResult(result));

  assert.notEqual(result.isError, true);
  assert.equal(typeof payload.timezone, "string", "connection_status must expose timezone");
  assert.ok(payload.timezone.length > 0);
  // Either the env-set value or a real IANA name. Both contain "/" except UTC.
  assert.ok(
    payload.timezone === "UTC" || payload.timezone.includes("/"),
    `expected IANA tz or "UTC", got: ${payload.timezone}`,
  );
}

// --- Sprint 3 / D1: nourish_undo_last removes the most recent intake or
//     hydration entry and returns it so the agent can re-log if it was a
//     mistake. Requires explicit_user_intent. ---
async function assertUndoLastWorks() {
  // First, the guard.
  const guarded = await client.callTool({
    name: "nourish_undo_last",
    arguments: { kind: "any" },
  });
  const guardedPayload = JSON.parse(textFromToolResult(guarded));
  assert.equal(guardedPayload.error?.code, "USER_ACTION_REQUIRED", "explicit_user_intent guard");

  // Empty case — undo when nothing to undo should be a no-op (ok: true, undone: null).
  // (Some leftover data may exist from previous assertions; clear by undoing
  //  until empty for both kinds.)
  for (let i = 0; i < 30; i++) {
    const r = await client.callTool({
      name: "nourish_undo_last",
      arguments: { kind: "any", explicit_user_intent: true },
    });
    const p = JSON.parse(textFromToolResult(r));
    if (p.undone === null) break;
  }

  const emptyResult = await client.callTool({
    name: "nourish_undo_last",
    arguments: { kind: "any", explicit_user_intent: true },
  });
  const emptyPayload = JSON.parse(textFromToolResult(emptyResult));
  assert.equal(emptyPayload.undone, null, "undo with empty stores returns undone:null");

  // Log an intake entry, then undo it.
  const logIntake = await client.callTool({
    name: "nourish_log_intake",
    arguments: {
      explicit_user_intent: true,
      text: "qa undo test - 1 banana",
      meal_type: "snack",
    },
  });
  const intakePayload = JSON.parse(textFromToolResult(logIntake));
  assert.notEqual(logIntake.isError, true);

  const undoIntake = await client.callTool({
    name: "nourish_undo_last",
    arguments: { kind: "intake", explicit_user_intent: true },
  });
  const undoIntakePayload = JSON.parse(textFromToolResult(undoIntake));
  assert.notEqual(undoIntake.isError, true);
  assert.equal(undoIntakePayload.undone?.kind, "intake");
  assert.equal(undoIntakePayload.undone?.entry?.id, intakePayload.id, "must undo the entry we just logged");
  assert.equal(undoIntakePayload.deleted, true);

  // Log a water entry, then undo with kind:"any" — must pick the water entry
  // because that's now the most recent.
  await client.callTool({
    name: "nourish_log_water",
    arguments: { explicit_user_intent: true, amount_ml: 250 },
  });

  const undoAny = await client.callTool({
    name: "nourish_undo_last",
    arguments: { kind: "any", explicit_user_intent: true },
  });
  const undoAnyPayload = JSON.parse(textFromToolResult(undoAny));
  assert.notEqual(undoAny.isError, true);
  assert.equal(undoAnyPayload.undone?.kind, "hydration", "kind:'any' must pick the most recent across stores");
  assert.equal(undoAnyPayload.deleted, true);
}

function assertSearchSchemaHonest(tools) {
  const searchTool = findTool(tools, "nourish_search_food");
  const provider = searchTool.inputSchema?.properties?.provider;

  if (provider !== undefined) {
    assert.deepEqual(provider.enum, ["usda", "open_food_facts", "br_local", "all"]);
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
