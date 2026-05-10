import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import {
  AgentManifestInputSchema,
  BarcodeImageDecodeInputSchema,
  BarcodeImageLookupInputSchema,
  BarcodeLookupInputSchema,
  CoachInputSchema,
  ClearDayInputSchema,
  BulkLogIntakeInputSchema,
  CarbonSummaryInputSchema,
  ClearHydrationDayInputSchema,
  CompareDaysInputSchema,
  DailySummaryInputSchema,
  HydrationDeleteInputSchema,
  UndoLastInputSchema,
  ExportInputSchema,
  FoodImageAnalysisInputSchema,
  FoodGetInputSchema,
  FoodSearchInputSchema,
  ForgetMemoryInputSchema,
  GoalsSetInputSchema,
  HydrationLogInputSchema,
  IntakeDeleteInputSchema,
  IntakeListInputSchema,
  IntakeLogInputSchema,
  IntakeUpdateInputSchema,
  MealEstimateInputSchema,
  PhotoMealEstimateInputSchema,
  RememberMealInputSchema,
  ResponseOnlyInputSchema,
  SummaryInputSchema,
  WeeklySummaryInputSchema,
} from "../schemas/common.js";
import { getUsdaFood, searchUsdaFoods } from "../providers/usda.js";
import { searchBrazilianLocalFoods } from "../providers/br-local.js";
import { getTacoFood, searchTacoFoods } from "../providers/taco.js";
import {
  carbonDatasetSize,
  computeMealCarbon,
  suggestCarbonSwaps,
  type CarbonMealItem,
} from "../services/carbon-enrichment.js";
import { lookupOpenFoodFactsBarcode, searchOpenFoodFactsByName } from "../providers/open-food-facts.js";
import { buildAgentManifest } from "../services/agent-manifest.js";
import { buildCapabilities } from "../services/capabilities.js";
import { buildNutritionCoach, type CoachMode } from "../services/coach.js";
import { buildConnectionStatus } from "../services/connection-status.js";
import {
  makeActionRequired,
  makeError,
  makeValidationError,
  makeResponse,
  bulletList,
  compactTable,
  type McpTextResponse,
} from "../services/format.js";
import {
  addIntakeEntry,
  clearIntakeDay,
  deleteIntakeEntry,
  exportIntakeCsvData,
  exportIntakeData,
  listIntakeEntries,
  updateIntakeEntry,
  type AddIntakeEntryInput,
} from "../services/intake-store.js";
import { buildHydrationSummary, clearHydrationDay, deleteWaterEntry, listWaterEntries, logWater } from "../services/hydration-store.js";
import { getGoals, updateGoals } from "../services/goals-store.js";
import { analyzeFoodImage } from "../services/food-image-analysis.js";
import { decodeBarcodeImage } from "../services/image-decoder.js";
import { estimateMeal } from "../services/meal-estimator.js";
import { localDate } from "../services/local-date.js";
import {
  expandMealTextWithMemory,
  forgetRememberedMeal,
  getPersonalNutritionMemory,
  rememberMeal,
} from "../services/personal-memory.js";
import { gramsForQuantity, nutrientsForGrams } from "../services/portion-engine.js";
import { estimateMealFromPhotoObservation } from "../services/photo-meal-estimator.js";
import { buildPrivacyAudit } from "../services/privacy-audit.js";
import { buildDailySummary, buildWeeklySummary } from "../services/summary.js";
import type { FoodItem, IntakeEntry, NutrientMap, ProviderSource, ResponseFormat } from "../types.js";

type UnknownRecord = Record<string, unknown>;

export function registerNourishTools(server: McpServer): void {
  server.registerTool(
    "nourish_agent_manifest",
    {
      title: "Nourish agent manifest",
      description: "Return agent-facing install, safety, resource, and first-call guidance.",
      inputSchema: AgentManifestInputSchema.shape,
      annotations: readOnlyAnnotation(),
    },
    async (input) => {
      try {
        const params = AgentManifestInputSchema.parse(input);
        const manifest = buildAgentManifest(params.client);
        const firstTools = manifest.recommended_first_calls.join(", ");
        const markdown = bulletList("Nourish Agent Manifest", {
          name: manifest.name,
          version: manifest.version,
          client: manifest.client,
          first_tools: firstTools,
        });

        return toolResponse(makeResponse(manifest, params.response_format, markdown));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_capabilities",
    {
      title: "Nourish capabilities",
      description: "Describe supported nutrition workflows, providers, and recommended first tools.",
      inputSchema: ResponseOnlyInputSchema.shape,
      annotations: readOnlyAnnotation(),
    },
    async (input) => {
      try {
        const params = ResponseOnlyInputSchema.parse(input);
        return toolResponse(makeResponse(buildCapabilities(), params.response_format));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_connection_status",
    {
      title: "Nourish connection status",
      description: "Report local storage, fixture, USDA, and Open Food Facts readiness without returning secrets.",
      inputSchema: ResponseOnlyInputSchema.shape,
      annotations: readOnlyAnnotation(),
    },
    async (input) => {
      try {
        const params = ResponseOnlyInputSchema.parse(input);
        return toolResponse(makeResponse(buildConnectionStatus(), params.response_format));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_quickstart",
    {
      title: "Nourish quickstart",
      description:
        "Personalized 3-step setup walkthrough for the human user. Adapts to current state (USDA key set? OFF enabled? local-dir writable?). Call this first when the user asks 'how do I use this?'",
      inputSchema: ResponseOnlyInputSchema.shape,
      annotations: readOnlyAnnotation(),
    },
    async (input) => {
      try {
        const params = ResponseOnlyInputSchema.parse(input);
        const status = buildConnectionStatus();
        const hasUsdaKey = Boolean(process.env.FDC_API_KEY);
        const offEnabled = status.open_food_facts_enabled;
        const steps = [
          {
            step: 1,
            title: hasUsdaKey ? "(done) USDA FoodData Central key configured" : "(Optional) Add a free USDA API key",
            action: hasUsdaKey
              ? "FDC_API_KEY is set. USDA search returns the full FoodData Central catalog."
              : "Sign up at https://fdc.nal.usda.gov/api-key-signup.html (free, 30 seconds). Set FDC_API_KEY in env. Without it, USDA search uses the rate-limited DEMO_KEY.",
            done: hasUsdaKey,
          },
          {
            step: 2,
            title: offEnabled ? "(done) Open Food Facts enabled" : "Enable Open Food Facts for barcode coverage",
            action: offEnabled
              ? "NOURISH_OFF_ENABLED=1 is set. Barcode lookups query the full OFF database (1.5M packaged products)."
              : "Set NOURISH_OFF_ENABLED=1 in env or MCP config to unlock barcode + barcode-photo lookup.",
            done: offEnabled,
          },
          {
            step: 3,
            title: "Verify with the agent",
            action:
              "Try `nourish_search_food { query: 'banana' }` or `nourish_estimate_meal { text: '100g chicken + 1 cup rice' }`. The agent should return calories + macros + carbon footprint.",
            example:
              hasUsdaKey && offEnabled
                ? "All set — you can also try nourish_estimate_meal_photo (with agent vision), nourish_lookup_barcode, nourish_daily_coach."
                : "After steps 1-2, the full surface activates.",
            done: false,
          },
        ];
        const remaining = steps.filter((s) => !s.done && s.step !== 3).length;
        const payload = {
          ok: true,
          ready: remaining === 0,
          configured: { usda_key: hasUsdaKey, off_enabled: offEnabled },
          steps,
          next: steps.find((s) => !s.done) ?? steps[steps.length - 1],
          cross_connector_hints: [
            "Pair with whoop-mcp / ouramcp / garminmcp for wearable-aware meal coaching (nourish_daily_coach takes wearable_context).",
            "Pair with wellness-cgm-mcp for meal→glucose response correlation.",
            "Pair with wellness-cycle-coach for phase-aware nutrition (iron in menstrual, magnesium in luteal, etc.).",
          ],
        };
        return toolResponse(makeResponse(payload, params.response_format));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_demo",
    {
      title: "Nourish demo",
      description:
        "Returns realistic example payloads of nourish_search_food, nourish_estimate_meal, and nourish_daily_summary so agents see the contract before any real call.",
      inputSchema: ResponseOnlyInputSchema.shape,
      annotations: readOnlyAnnotation(),
    },
    async (input) => {
      try {
        const params = ResponseOnlyInputSchema.parse(input);
        const payload = {
          ok: true,
          is_demo: true,
          sample: {
            nourish_search_food: {
              ok: true,
              results: [
                {
                  source: "usda",
                  name: "Banana, raw",
                  serving: { quantity: 1, unit: "medium (118g)", grams: 118 },
                  nutrients_per_serving: { calories_kcal: 105, protein_g: 1.3, carbohydrates_g: 27, fiber_g: 3.1, sugar_g: 14.4, fat_g: 0.4 },
                  carbon: { kg_co2e_per_kg: 0.7, source: "agribalyse:fruits-banana", confidence: "high" },
                  data_quality: { completeness: "high", confidence: 0.95, warnings: [] },
                },
              ],
            },
            nourish_estimate_meal: {
              ok: true,
              text: "100g grilled chicken breast + 1 cup white rice",
              total_grams: 258,
              total_nutrients: { calories_kcal: 370, protein_g: 35.1, carbohydrates_g: 45.6, fat_g: 4.2 },
              total_carbon_kg_co2e: 0.74,
              confidence: 0.82,
              warnings: [],
              source: "estimate",
            },
            nourish_daily_summary: {
              date: new Date().toISOString().slice(0, 10),
              meals: 3,
              hydration_ml: 1850,
              nutrients: { calories_kcal: 2104, protein_g: 128, carbohydrates_g: 224, fat_g: 78, fiber_g: 28 },
              carbon_kg_co2e: 4.2,
              goals_met: { calories: true, protein: true, fiber: false, hydration: false },
              insights: ["Protein on target.", "Fiber 4g short of goal — try adding berries to breakfast."],
            },
          },
          notes: [
            "All sample data is synthetic; tagged with is_demo=true.",
            "In real use, results return live USDA + Open Food Facts + Brazilian TACO matches with full carbon-footprint enrichment.",
          ],
        };
        return toolResponse(makeResponse(payload, params.response_format));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_privacy_audit",
    {
      title: "Nourish privacy audit",
      description: "Describe local storage, secret handling, source licensing, and safety boundaries.",
      inputSchema: ResponseOnlyInputSchema.shape,
      annotations: readOnlyAnnotation(),
    },
    async (input) => {
      try {
        const params = ResponseOnlyInputSchema.parse(input);
        return toolResponse(makeResponse(buildPrivacyAudit(), params.response_format));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_search_food",
    {
      title: "Search foods",
      description: "Search food providers by query. Use taco or br_local for Brazilian staples, open_food_facts for packaged products, usda for generic foods, or all.",
      inputSchema: FoodSearchInputSchema.shape,
      annotations: readOnlyOpenWorldAnnotation(),
    },
    async (input) => {
      try {
        const params = FoodSearchInputSchema.parse(input);
        const result = await searchFoods(params.query, params.limit, params.provider);
        const markdown = compactFoodTable(result.foods);

        return toolResponse(makeResponse(result, params.response_format, markdown));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_lookup_barcode",
    {
      title: "Lookup barcode",
      description: "Lookup a packaged food barcode in Open Food Facts.",
      inputSchema: BarcodeLookupInputSchema.shape,
      annotations: readOnlyOpenWorldAnnotation(),
    },
    async (input) => {
      try {
        const params = BarcodeLookupInputSchema.parse(input);
        const result = await lookupOpenFoodFactsBarcode(params.barcode);

        return toolResponse(makeResponse(result, params.response_format));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_decode_barcode_image",
    {
      title: "Decode barcode image",
      description: "Decode a barcode from an image path, base64 image, or data URI without logging intake.",
      inputSchema: BarcodeImageDecodeInputSchema.shape,
      annotations: readOnlyOpenWorldAnnotation(),
    },
    async (input) => {
      try {
        const params = BarcodeImageDecodeInputSchema.parse(input);
        const result = await decodeBarcodeImage(params);

        return toolResponse(makeResponse(result, params.response_format, barcodeDecodeMarkdown(result)));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_lookup_barcode_image",
    {
      title: "Lookup barcode image",
      description: "Decode a packaged-food barcode image, then lookup the product in Open Food Facts.",
      inputSchema: BarcodeImageLookupInputSchema.shape,
      annotations: readOnlyOpenWorldAnnotation(),
    },
    async (input) => {
      try {
        const params = BarcodeImageLookupInputSchema.parse(input);
        const decode = await decodeBarcodeImage(params);
        if (!decode.ok || decode.barcodes[0] === undefined) {
          const result = {
            ok: false,
            provider: "open_food_facts" as const,
            decode,
            lookup: null,
            warnings: decode.warnings,
          };

          return toolResponse(makeResponse(result, params.response_format, barcodeLookupImageMarkdown(result)));
        }

        const lookup = await lookupOpenFoodFactsBarcode(decode.barcodes[0].text);
        const result = {
          ok: true,
          provider: "open_food_facts" as const,
          barcode: decode.barcodes[0],
          decode,
          lookup,
          warnings: decode.warnings,
        };

        return toolResponse(makeResponse(result, params.response_format, barcodeLookupImageMarkdown(result)));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_get_food",
    {
      title: "Get food",
      description: "Fetch a USDA food by source_id, an Open Food Facts food by barcode source_id, or a TACO food by source_id.",
      inputSchema: FoodGetInputSchema.shape,
      annotations: readOnlyOpenWorldAnnotation(),
    },
    async (input) => {
      try {
        const params = FoodGetInputSchema.parse(input);
        const result = await getFoodBySource(params.source, params.source_id);

        return toolResponse(makeResponse(result, params.response_format));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_estimate_meal",
    {
      title: "Estimate meal",
      description: "Estimate nutrition for a short meal text using local deterministic defaults. Accepts text or meal_text; preserve unresolved and confidence.",
      inputSchema: MealEstimateInputSchema.shape,
      annotations: readOnlyAnnotation(),
    },
    async (input) => {
      try {
        const params = MealEstimateInputSchema.parse(input);
        const mealText = params.text ?? params.meal_text ?? "";
        const expanded = await expandMealTextWithMemory(mealText);
        const estimate = await estimateMeal({
          text: expanded.text,
          meal_type: params.meal_type,
          locale: params.locale,
        });
        const payload = {
          ...estimate,
          requested_text: mealText,
          personal_memory: {
            expanded: expanded.matches.length > 0,
            matches: expanded.matches,
          },
        };

        return toolResponse(makeResponse(payload, params.response_format));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_estimate_meal_photo",
    {
      title: "Estimate meal photo",
      description: "Estimate meal nutrition from an agent-provided photo observation; always requires user confirmation before logging.",
      inputSchema: PhotoMealEstimateInputSchema.shape,
      annotations: readOnlyAnnotation(),
    },
    async (input) => {
      try {
        const params = PhotoMealEstimateInputSchema.parse(input);
        const estimate = await estimateMealFromPhotoObservation(params);

        return toolResponse(makeResponse(estimate, params.response_format, photoMealEstimateMarkdown(estimate)));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_analyze_food_image",
    {
      title: "Analyze food image",
      description: "Route agent-provided food image observations across barcode, nutrition label OCR, or meal-photo estimation without logging.",
      inputSchema: FoodImageAnalysisInputSchema.shape,
      annotations: readOnlyOpenWorldAnnotation(),
    },
    async (input) => {
      try {
        const params = FoodImageAnalysisInputSchema.parse(input);
        const result = await analyzeFoodImage(params);

        return toolResponse(makeResponse(result, params.response_format));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_log_intake",
    {
      title: "Log intake",
      description: "Log an intake entry only after explicit user intent. Pass explicit_user_intent: true after the user asks to save/log/register; accepts text or meal_text plus structured food data.",
      inputSchema: IntakeLogInputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const params = IntakeLogInputSchema.parse(input);
        if (params.explicit_user_intent !== true) {
          return explicitIntentRequired("explicit_user_intent must be true to log intake.", params.response_format);
        }

        const entry = await addIntakeEntry(await buildIntakeEntryInput(params));

        return toolResponse(makeResponse(entry, params.response_format));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  registerCoachTool(server, "nourish_daily_coach", "daily_coach", "Daily nutrition coach", "Summarize today, goal gaps, wearable context, and a safe next action for Telegram-style coaching.");
  registerCoachTool(server, "nourish_suggest_next_meal", "suggest_next_meal", "Suggest next meal", "Suggest a next meal from today's intake, goals, personal memory, and optional wearable context.");
  registerCoachTool(server, "nourish_after_log_review", "after_log_review", "After-log review", "Review the day after a meal log and explain what changed plus the next correction or action.");
  registerCoachTool(server, "nourish_pre_workout_nutrition", "pre_workout_nutrition", "Pre-workout nutrition", "Suggest light pre-workout nutrition using goals, current intake, and optional WHOOP/Garmin context.");
  registerCoachTool(server, "nourish_evening_checkin", "evening_checkin", "Evening check-in", "Check late-day protein, calories, and hydration gaps with a compact Telegram-friendly next step.");

  server.registerTool(
    "nourish_remember_meal",
    {
      title: "Remember meal",
      description: "Save a personal meal shortcut locally after explicit user intent, for example 'meu cafe normal' -> '2 ovos e banana'.",
      inputSchema: RememberMealInputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const params = RememberMealInputSchema.parse(input);
        if (params.explicit_user_intent !== true) {
          return explicitIntentRequired("explicit_user_intent must be true to remember a personal meal.", params.response_format);
        }
        const meal = await rememberMeal(params);

        return toolResponse(makeResponse({ ok: true, meal }, params.response_format));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_list_memory",
    {
      title: "List personal nutrition memory",
      description: "Read local remembered meals and nutrition preferences for personal Telegram shortcuts.",
      inputSchema: ResponseOnlyInputSchema.shape,
      annotations: readOnlyAnnotation(),
    },
    async (input) => {
      try {
        const params = ResponseOnlyInputSchema.parse(input);
        const memory = await getPersonalNutritionMemory();

        return toolResponse(makeResponse(memory, params.response_format));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_forget_memory",
    {
      title: "Forget personal nutrition memory",
      description: "Delete a local remembered meal by id or label after explicit user intent.",
      inputSchema: ForgetMemoryInputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const params = ForgetMemoryInputSchema.parse(input);
        if (params.explicit_user_intent !== true) {
          return explicitIntentRequired("explicit_user_intent must be true to forget personal nutrition memory.", params.response_format);
        }
        const result = await forgetRememberedMeal(params.id_or_label);

        return toolResponse(makeResponse({ ok: true, ...result }, params.response_format));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_update_intake",
    {
      title: "Update intake",
      description: "Update a local intake entry by id. Quantity or grams_estimate changes rescale nutrients to keep summaries consistent.",
      inputSchema: IntakeUpdateInputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const params = IntakeUpdateInputSchema.parse(input);
        const patch: Parameters<typeof updateIntakeEntry>[1] = {};
        if (params.meal_type !== undefined) {
          patch.meal_type = params.meal_type;
        }
        if (params.quantity !== undefined) {
          patch.quantity = params.quantity;
        }
        if (params.unit !== undefined) {
          patch.unit = params.unit;
        }
        if (params.grams_estimate !== undefined) {
          patch.grams_estimate = params.grams_estimate;
        }
        if (params.timestamp !== undefined) {
          patch.timestamp = params.timestamp;
        }
        if (params.notes !== undefined) {
          patch.notes = params.notes;
        }
        if (params.tags !== undefined) {
          patch.tags = params.tags;
        }

        const entry = await updateIntakeEntry(params.id, patch);

        return toolResponse(makeResponse(entry, params.response_format));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_list_intake",
    {
      title: "List intake",
      description: "List local intake entries with optional filters: date OR since/until range, meal_type, tag, source_trace, min_confidence, limit. All filters AND together. Returns most-recent-first.",
      inputSchema: IntakeListInputSchema.shape,
      annotations: readOnlyAnnotation(),
    },
    async (input) => {
      try {
        const params = IntakeListInputSchema.parse(input);

        // Single-day filter wins (mutually exclusive with since/until per the schema docs).
        let entries = params.date !== undefined
          ? await listIntakeEntries({ date: params.date })
          : await listIntakeEntries();

        if (params.since !== undefined) {
          entries = entries.filter((entry) => entry.date >= params.since!);
        }
        if (params.until !== undefined) {
          entries = entries.filter((entry) => entry.date <= params.until!);
        }
        if (params.meal_type !== undefined) {
          entries = entries.filter((entry) => entry.meal_type === params.meal_type);
        }
        if (params.tag !== undefined) {
          entries = entries.filter((entry) => entry.tags.includes(params.tag!));
        }
        if (params.source_trace !== undefined) {
          entries = entries.filter((entry) => entry.source_trace === params.source_trace);
        }
        if (params.min_confidence !== undefined) {
          entries = entries.filter((entry) => entry.confidence >= params.min_confidence!);
        }

        // Most-recent-first ordering.
        entries = [...entries].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

        if (params.limit !== undefined) {
          entries = entries.slice(0, params.limit);
        }

        const markdown = compactIntakeTable(entries);

        return toolResponse(
          makeResponse(
            {
              entries,
              applied_filters: {
                date: params.date,
                since: params.since,
                until: params.until,
                meal_type: params.meal_type,
                tag: params.tag,
                source_trace: params.source_trace,
                min_confidence: params.min_confidence,
                limit: params.limit,
              },
              count: entries.length,
            },
            params.response_format,
            markdown,
          ),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_delete_intake",
    {
      title: "Delete intake",
      description: "Delete a local intake entry by id.",
      inputSchema: IntakeDeleteInputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const params = IntakeDeleteInputSchema.parse(input);
        const deleted = await deleteIntakeEntry(params.id);

        return toolResponse(makeResponse({ ok: true, deleted, id: params.id }, params.response_format));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_clear_day",
    {
      title: "Clear day",
      description: "Delete all local intake entries for a date after explicit user intent.",
      inputSchema: ClearDayInputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const params = ClearDayInputSchema.parse(input);
        if (params.explicit_user_intent !== true) {
          return explicitIntentRequired("explicit_user_intent must be true to clear a day.", params.response_format);
        }
        const intakeResult = await clearIntakeDay(params.date);
        const result: {
          date: string;
          deleted_entries: number;
          hydration?: { deleted_entries: number };
        } = {
          date: intakeResult.date,
          deleted_entries: intakeResult.deleted_entries,
        };

        if (params.include_hydration === true) {
          const hydrationResult = await clearHydrationDay(params.date);
          result.hydration = { deleted_entries: hydrationResult.deleted_entries };
        }

        return toolResponse(makeResponse(result, params.response_format));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_delete_water",
    {
      title: "Delete water entry",
      description: "Delete a single local hydration entry by id after explicit user intent.",
      inputSchema: HydrationDeleteInputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const params = HydrationDeleteInputSchema.parse(input);
        if (params.explicit_user_intent !== true) {
          return explicitIntentRequired(
            "explicit_user_intent must be true to delete a hydration entry.",
            params.response_format,
          );
        }
        const deleted = await deleteWaterEntry(params.id);

        return toolResponse(makeResponse({ ok: true, deleted, id: params.id }, params.response_format));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_clear_hydration_day",
    {
      title: "Clear hydration day",
      description:
        "Delete all local hydration entries for a date after explicit user intent. Does not touch intake — pair with nourish_clear_day or use nourish_clear_day { include_hydration: true } for both.",
      inputSchema: ClearHydrationDayInputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const params = ClearHydrationDayInputSchema.parse(input);
        if (params.explicit_user_intent !== true) {
          return explicitIntentRequired(
            "explicit_user_intent must be true to clear hydration for a day.",
            params.response_format,
          );
        }
        const result = await clearHydrationDay(params.date);

        return toolResponse(makeResponse(result, params.response_format));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_carbon_summary",
    {
      title: "Carbon footprint summary",
      description:
        "Estimate the carbon footprint (kg CO2-equivalent) of a meal, plus optional lower-carbon swap suggestions. Pass `items: [{name, grams}, ...]` for an arbitrary meal, OR `date: YYYY-MM-DD` to compute carbon over that day's logged intake. Data: Agribalyse 3.1 (Etalab Open License) + Our World in Data / Poore & Nemecek 2018 (CC-BY 4.0). Read-only; never mutates state.",
      inputSchema: CarbonSummaryInputSchema.shape,
      annotations: readOnlyAnnotation(),
    },
    async (input) => {
      try {
        const params = CarbonSummaryInputSchema.parse(input);

        // Build the carbon meal items list. Either explicit `items` or
        // pulled from the day's intake log.
        let mealItems: CarbonMealItem[] = [];
        let sourceLabel: "items" | "intake_log";
        let resolvedDate: string | undefined;

        if (params.items !== undefined && params.items.length > 0) {
          mealItems = params.items.map((item) => ({ name: item.name, grams: item.grams }));
          sourceLabel = "items";
        } else {
          resolvedDate = params.date ?? localDate();
          const entries = await listIntakeEntries(
            resolvedDate === undefined ? {} : { date: resolvedDate },
          );
          mealItems = entries
            .filter((entry) => entry.grams_estimate !== undefined && entry.grams_estimate > 0)
            .map((entry) => ({
              name: entry.food_ref?.name ?? entry.custom_food?.name ?? "unknown",
              grams: entry.grams_estimate as number,
              // Use the entry's own custom_food.carbon if it was set during logging.
              carbon: entry.custom_food?.carbon,
            }));
          sourceLabel = "intake_log";
        }

        if (mealItems.length === 0) {
          return toolResponse(
            makeResponse(
              {
                ok: true,
                source: sourceLabel,
                date: resolvedDate,
                total_kg_co2e: 0,
                items: [],
                unmatched_count: 0,
                message: sourceLabel === "intake_log"
                  ? "No logged intake entries with grams_estimate found for the requested date."
                  : "No items provided.",
              },
              params.response_format,
            ),
          );
        }

        const result = computeMealCarbon(mealItems);

        const swaps = params.include_swap_suggestions
          ? suggestCarbonSwaps(mealItems, 3)
          : [];

        return toolResponse(
          makeResponse(
            {
              ok: true,
              source: sourceLabel,
              date: resolvedDate,
              total_kg_co2e: result.total_kg_co2e,
              items: result.items,
              unmatched_count: result.unmatched_count,
              equivalents: result.equivalents,
              swap_suggestions: swaps,
              dataset_attribution: {
                agribalyse: "Agribalyse 3.1 (ADEME) — Etalab Open License",
                owid: "Our World in Data, derived from Poore & Nemecek 2018 — CC-BY 4.0",
                version_note: `v1 ships ${carbonDatasetSize()} curated entries; full Agribalyse + SU-EATABLE LIFE ingest planned for next release.`,
              },
              warnings:
                result.unmatched_count > 0
                  ? [`${result.unmatched_count} item(s) had no carbon data — totals exclude them.`]
                  : [],
            },
            params.response_format,
          ),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_undo_last",
    {
      title: "Undo last entry",
      description:
        "Undo the most recently logged intake or hydration entry. The most common Telegram/agent recovery move ('I logged the wrong thing'). Returns what was undone so the agent can confirm. Requires explicit_user_intent. Pass kind: 'intake' | 'hydration' | 'any' (default 'any') to scope the undo.",
      inputSchema: UndoLastInputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const params = UndoLastInputSchema.parse(input);
        if (params.explicit_user_intent !== true) {
          return explicitIntentRequired(
            "explicit_user_intent must be true to undo the last entry.",
            params.response_format,
          );
        }

        // Pick the most recent entry from each store and decide which to delete.
        const [intakeAll, waterAll] = await Promise.all([
          params.kind === "hydration" ? Promise.resolve([]) : listIntakeEntries(),
          params.kind === "intake" ? Promise.resolve([]) : listWaterEntries(),
        ]);

        const lastIntake =
          intakeAll.length === 0
            ? undefined
            : [...intakeAll].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
        const lastWater =
          waterAll.length === 0
            ? undefined
            : [...waterAll].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];

        let chosen: { kind: "intake"; entry: typeof lastIntake } | { kind: "hydration"; entry: typeof lastWater } | undefined;

        if (lastIntake !== undefined && lastWater !== undefined) {
          chosen = lastIntake.timestamp >= lastWater.timestamp
            ? { kind: "intake", entry: lastIntake }
            : { kind: "hydration", entry: lastWater };
        } else if (lastIntake !== undefined) {
          chosen = { kind: "intake", entry: lastIntake };
        } else if (lastWater !== undefined) {
          chosen = { kind: "hydration", entry: lastWater };
        }

        if (chosen === undefined || chosen.entry === undefined) {
          return toolResponse(
            makeResponse(
              {
                ok: true,
                undone: null,
                message: "No matching entries to undo (kind: " + params.kind + ").",
              },
              params.response_format,
            ),
          );
        }

        const undoneEntry = chosen.entry;
        const deleted = chosen.kind === "intake"
          ? await deleteIntakeEntry(undoneEntry.id)
          : await deleteWaterEntry(undoneEntry.id);

        return toolResponse(
          makeResponse(
            {
              ok: true,
              deleted,
              undone: {
                kind: chosen.kind,
                entry: undoneEntry,
              },
              note: "Undo is permanent — the entry is removed from the JSONL store. The full entry is returned so the agent can re-log it if the undo was a mistake.",
            },
            params.response_format,
          ),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_log_water",
    {
      title: "Log water",
      description: "Log local hydration in milliliters after explicit user intent. Pass explicit_user_intent: true after the user asks to save/log water.",
      inputSchema: HydrationLogInputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const params = HydrationLogInputSchema.parse(input);
        if (params.explicit_user_intent !== true) {
          return explicitIntentRequired("explicit_user_intent must be true to log hydration.", params.response_format);
        }
        const waterInput: Parameters<typeof logWater>[0] = {
          amount_ml: params.amount_ml,
          source: "agent",
        };
        const timestamp = params.timestamp ?? dateToNoonTimestamp(params.date);
        if (timestamp !== undefined) {
          waterInput.timestamp = timestamp;
        }
        if (params.notes !== undefined) {
          waterInput.notes = params.notes;
        }
        const entry = await logWater(waterInput);

        return toolResponse(makeResponse(entry, params.response_format));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_hydration_summary",
    {
      title: "Hydration summary",
      description: "Summarize local hydration for a date.",
      inputSchema: SummaryInputSchema.shape,
      annotations: readOnlyAnnotation(),
    },
    async (input) => {
      try {
        const params = SummaryInputSchema.parse(input);
        const summary = await buildHydrationSummary(params.date);

        return toolResponse(makeResponse(summary, params.response_format));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_get_goals",
    {
      title: "Get goals",
      description: "Read local calorie, macro, and hydration goals.",
      inputSchema: ResponseOnlyInputSchema.shape,
      annotations: readOnlyAnnotation(),
    },
    async (input) => {
      try {
        const params = ResponseOnlyInputSchema.parse(input);

        return toolResponse(makeResponse(await getGoals(), params.response_format));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_set_goals",
    {
      title: "Set goals",
      description: "Set local calorie, macro, and hydration goals after explicit user intent. Use daily: {...} or flat shortcuts like calories_kcal/protein_g; pass explicit_user_intent: true after confirmation.",
      inputSchema: GoalsSetInputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const params = GoalsSetInputSchema.parse(input);
        if (params.explicit_user_intent !== true) {
          return explicitIntentRequired("explicit_user_intent must be true to update goals.", params.response_format);
        }
        const flatDaily = cleanNutrients({
          calories_kcal: params.calories_kcal,
          protein_g: params.protein_g,
          carbohydrates_g: params.carbohydrates_g,
          fat_g: params.fat_g,
          fiber_g: params.fiber_g,
          sugar_g: params.sugar_g,
        });
        const daily = cleanNutrients({
          ...flatDaily,
          ...(params.daily ?? {}),
        });
        const result = await updateGoals({
          ...(hasMeaningfulNutrients(daily) ? { daily } : {}),
          ...(params.hydration_ml === undefined ? {} : { hydration_ml: params.hydration_ml }),
        });

        return toolResponse(makeResponse(result, params.response_format));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_daily_summary",
    {
      title: "Daily summary",
      description: "Summarize local intake totals, confidence, and source coverage for a date. Pass `compare_to: 'yesterday'` or `compare_to: '7d_avg'` to add a `comparison` block with per-nutrient deltas — useful for trend coaching ('your protein is low again — third day in a row').",
      inputSchema: DailySummaryInputSchema.shape,
      annotations: readOnlyAnnotation(),
    },
    async (input) => {
      try {
        const params = DailySummaryInputSchema.parse(input);
        const summary = await buildDailySummary(params.date);

        let comparison: Record<string, unknown> | undefined;
        if (params.compare_to === "yesterday") {
          const yesterdayDate = addDaysToDate(summary.date, -1);
          const baseline = await buildDailySummary(yesterdayDate);
          comparison = {
            kind: "yesterday",
            baseline_date: yesterdayDate,
            deltas: nutrientDeltas(baseline.total_nutrients, summary.total_nutrients),
            entry_count_delta: summary.entry_count - baseline.entry_count,
          };
        } else if (params.compare_to === "7d_avg") {
          const days = await Promise.all(
            [1, 2, 3, 4, 5, 6, 7].map((offset) => buildDailySummary(addDaysToDate(summary.date, -offset))),
          );
          const avgNutrients = averageNutrients(days.map((day) => day.total_nutrients));
          comparison = {
            kind: "7d_avg",
            baseline_window: { from: addDaysToDate(summary.date, -7), to: addDaysToDate(summary.date, -1) },
            deltas: nutrientDeltas(avgNutrients, summary.total_nutrients),
            avg_baseline: avgNutrients,
          };
        }

        return toolResponse(
          makeResponse(
            comparison === undefined ? summary : { ...summary, comparison },
            params.response_format,
          ),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_compare_days",
    {
      title: "Compare two days",
      description:
        "Compute a per-nutrient diff between two days' summaries. Returns deltas (date_b - date_a) for calories, protein, carbs, fat, fiber, sugar, sodium plus what changed by meal type. Useful for 'how was today vs yesterday?' coaching.",
      inputSchema: CompareDaysInputSchema.shape,
      annotations: readOnlyAnnotation(),
    },
    async (input) => {
      try {
        const params = CompareDaysInputSchema.parse(input);
        const [summaryA, summaryB] = await Promise.all([
          buildDailySummary(params.date_a),
          buildDailySummary(params.date_b),
        ]);

        return toolResponse(
          makeResponse(
            {
              date_a: params.date_a,
              date_b: params.date_b,
              totals_a: summaryA.total_nutrients,
              totals_b: summaryB.total_nutrients,
              deltas: nutrientDeltas(summaryA.total_nutrients, summaryB.total_nutrients),
              entry_count_delta: summaryB.entry_count - summaryA.entry_count,
              hydration_delta_ml: summaryB.hydration.total_ml - summaryA.hydration.total_ml,
              by_meal_changed: meaningfulMealDifferences(summaryA.by_meal, summaryB.by_meal),
            },
            params.response_format,
          ),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_bulk_log_intake",
    {
      title: "Bulk log intake",
      description:
        "Log multiple intake entries in a single call. Each item is processed through the same text-estimator pipeline as `nourish_log_intake`, but the entire batch shares one explicit_user_intent flag — perfect for Telegram users who say 'log everything I ate today: breakfast was X, lunch was Y, dinner was Z'. Returns per-item success/failure so a partial failure doesn't lose the rest.",
      inputSchema: BulkLogIntakeInputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const params = BulkLogIntakeInputSchema.parse(input);
        if (params.explicit_user_intent !== true) {
          return explicitIntentRequired(
            "explicit_user_intent must be true to bulk-log intake.",
            params.response_format,
          );
        }

        const results: Array<{ index: number; ok: boolean; entry?: unknown; error?: string }> = [];
        for (const [index, item] of params.items.entries()) {
          try {
            const itemInput = IntakeLogInputSchema.parse({
              text: item.text,
              meal_type: item.meal_type ?? "snack",
              notes: item.notes,
              tags: item.tags,
              explicit_user_intent: true,
            });
            const built = await buildIntakeEntryInput(itemInput);
            const entry = await addIntakeEntry(built);
            results.push({ index, ok: true, entry });
          } catch (err) {
            results.push({
              index,
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        const ok_count = results.filter((r) => r.ok).length;
        return toolResponse(
          makeResponse(
            {
              ok: ok_count === params.items.length,
              total: params.items.length,
              ok_count,
              failed_count: params.items.length - ok_count,
              results,
            },
            params.response_format,
          ),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_weekly_summary",
    {
      title: "Weekly summary",
      description: "Summarize seven days of local intake totals from a start date.",
      inputSchema: WeeklySummaryInputSchema.shape,
      annotations: readOnlyAnnotation(),
    },
    async (input) => {
      try {
        const params = WeeklySummaryInputSchema.parse(input);
        const summary = await buildWeeklySummary(params.start_date);

        return toolResponse(makeResponse(summary, params.response_format));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_export_data",
    {
      title: "Export intake data",
      description: "Export local intake data as JSONL or CSV without provider secrets or tokens.",
      inputSchema: ExportInputSchema.shape,
      annotations: readOnlyAnnotation(),
    },
    async (input) => {
      try {
        const params = ExportInputSchema.parse(input);
        const exportText =
          params.export_format === "csv" ? await exportIntakeCsvData() : await exportIntakeData();

        return toolResponse(
          makeResponse(
            params.export_format === "csv" ? { csv: exportText } : { jsonl: exportText },
            params.response_format,
            exportText,
          ),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );
}

function readOnlyAnnotation() {
  return {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  };
}

function registerCoachTool(
  server: McpServer,
  name: string,
  mode: CoachMode,
  title: string,
  description: string,
): void {
  server.registerTool(
    name,
    {
      title,
      description,
      inputSchema: CoachInputSchema.shape,
      annotations: readOnlyAnnotation(),
    },
    async (input) => {
      try {
        const params = CoachInputSchema.parse(input);
        const result = await buildNutritionCoach({
          mode,
          date: params.date,
          locale: params.locale,
          focus: params.focus,
          meal_type: params.meal_type,
          wearable_context: params.wearable_context,
          workout_context: params.workout_context,
          recent_intake_id: params.recent_intake_id,
        });

        return toolResponse(makeResponse(result, params.response_format, coachMarkdown(result)));
      } catch (error) {
        return toolError(error);
      }
    },
  );
}

function readOnlyOpenWorldAnnotation() {
  return {
    ...readOnlyAnnotation(),
    openWorldHint: true,
  };
}

async function searchFoods(
  query: string,
  limit: number,
  provider: "usda" | "open_food_facts" | "br_local" | "taco" | "all",
): Promise<{ provider: string; foods: FoodItem[]; warnings?: string[] }> {
  if (provider === "usda") {
    return searchUsdaFoods(query, limit);
  }

  if (provider === "open_food_facts") {
    return searchOpenFoodFactsByName(query, limit);
  }

  if (provider === "br_local") {
    return searchBrazilianLocalFoods(query, limit);
  }

  if (provider === "taco") {
    return searchTacoFoods(query, limit);
  }

  // Parallel fan-out across all 3 providers — was sequential before, which
  // unfairly penalized "all" mode (the most useful default for users who
  // don't know which provider to pick). Each provider failure is converted
  // to a tagged warning so callers can tell which one(s) degraded.
  const named = [
    { provider: "taco", run: () => searchTacoFoods(query, limit) },
    { provider: "br_local", run: () => searchBrazilianLocalFoods(query, limit) },
    { provider: "open_food_facts", run: () => searchOpenFoodFactsByName(query, limit) },
    { provider: "usda", run: () => searchUsdaFoods(query, limit) },
  ] as const;

  const settled = await Promise.allSettled(named.map((entry) => entry.run()));

  const warnings: string[] = [];
  const foods: FoodItem[] = [];
  for (const [index, outcome] of settled.entries()) {
    const providerName = named[index]!.provider;
    if (outcome.status === "fulfilled") {
      foods.push(...outcome.value.foods);
      if ("warnings" in outcome.value && Array.isArray(outcome.value.warnings)) {
        for (const warning of outcome.value.warnings) {
          warnings.push(`${providerName}: ${warning}`);
        }
      }
    } else {
      const message = outcome.reason instanceof Error
        ? outcome.reason.message
        : String(outcome.reason);
      warnings.push(`${providerName}: ${message}`);
    }
  }

  return {
    provider: "all",
    foods: foods.slice(0, limit),
    warnings,
  };
}

function compactFoodTable(foods: FoodItem[]): string {
  return compactTable(
    foods.map((food) => ({
      name: food.name,
      source: food.source,
      calories: food.nutrients_per_100g.calories_kcal,
      protein: food.nutrients_per_100g.protein_g,
    })),
    ["name", "source", "calories", "protein"],
  );
}

function barcodeDecodeMarkdown(result: Awaited<ReturnType<typeof decodeBarcodeImage>>): string {
  const barcode = result.barcodes[0];
  if (barcode === undefined) {
    return bulletList("Barcode Image", {
      ok: result.ok,
      source: result.image.source,
      warnings: result.warnings,
    });
  }

  return bulletList("Barcode Image", {
    ok: result.ok,
    barcode: barcode.text,
    format: barcode.format,
    rotation_degrees: barcode.rotation_degrees,
    source: result.image.source,
  });
}

function barcodeLookupImageMarkdown(result: {
  ok: boolean;
  barcode?: Awaited<ReturnType<typeof decodeBarcodeImage>>["barcodes"][number];
  lookup: Awaited<ReturnType<typeof lookupOpenFoodFactsBarcode>> | null;
  warnings: string[];
}): string {
  if (!result.ok || result.lookup === null) {
    return bulletList("Barcode Image Lookup", {
      ok: false,
      warnings: result.warnings,
    });
  }

  return bulletList("Barcode Image Lookup", {
    ok: true,
    barcode: result.barcode?.text,
    food: result.lookup.food.name,
    calories_per_100g: result.lookup.food.nutrients_per_100g.calories_kcal,
    protein_per_100g: result.lookup.food.nutrients_per_100g.protein_g,
    source: result.lookup.food.source,
  });
}

function photoMealEstimateMarkdown(
  result: Awaited<ReturnType<typeof estimateMealFromPhotoObservation>>,
): string {
  return bulletList("Photo Meal Estimate", {
    calories: result.estimate.total_nutrients.calories_kcal,
    protein_g: result.estimate.total_nutrients.protein_g,
    confidence: result.estimate.confidence,
    requires_confirmation: result.requires_confirmation,
    can_log_without_confirmation: result.can_log_without_confirmation,
    detected_items: result.detected_items.map((item) => item.name),
    warnings: result.warnings,
  });
}

function coachMarkdown(result: Awaited<ReturnType<typeof buildNutritionCoach>>): string {
  return [
    `# Nourish Coach`,
    `- mode: ${result.mode}`,
    `- date: ${result.date}`,
    `- calories: ${result.summary.calories_kcal}`,
    `- protein_g: ${result.summary.protein_g}`,
    `- hydration_ml: ${result.summary.hydration_ml}`,
    `- suggested_next_meal: ${result.suggested_next_meal.text}`,
    `- reason: ${result.suggested_next_meal.reason}`,
    `- requires_confirmation_to_log: ${result.requires_confirmation_to_log}`,
    "",
    "## Next Actions",
    ...result.next_actions.map((action) => `- ${action}`),
  ].join("\n");
}

function compactIntakeTable(entries: IntakeEntry[]): string {
  return compactTable(
    entries.map((entry) => ({
      id: entry.id,
      date: entry.date,
      meal: entry.meal_type,
      food: entry.food_ref?.name ?? entry.custom_food?.name ?? "",
      calories: entry.nutrients.calories_kcal,
      confidence: entry.confidence,
    })),
    ["id", "date", "meal", "food", "calories", "confidence"],
  );
}

function toolResponse(response: McpTextResponse): CallToolResult {
  return response as unknown as CallToolResult;
}

function explicitIntentRequired(message: string, responseFormat: ResponseFormat): CallToolResult {
  return toolResponse(makeActionRequired(message, responseFormat));
}

async function buildIntakeEntryInput(
  params: ReturnType<typeof IntakeLogInputSchema.parse>,
): Promise<AddIntakeEntryInput> {
  const text = params.text ?? params.meal_text;
  const hasExplicitFoodData =
    params.nutrients !== undefined ||
    params.custom_food !== undefined ||
    params.food_ref !== undefined ||
    params.food !== undefined;

  // Estimate path: text-only, no explicit food/nutrient data.
  // Explicit data ALWAYS wins over text-derived estimate (N-001 fix).
  if (text !== undefined && !hasExplicitFoodData) {
    const expanded = await expandMealTextWithMemory(text);
    const estimate = await estimateMeal({
      text: expanded.text,
      meal_type: params.meal_type,
      locale: "en-US",
    });

    const input: AddIntakeEntryInput = {
      meal_type: params.meal_type,
      food_ref: {
        source: "estimate",
        source_id: stableEstimateId(text),
        name: text,
      },
      quantity: params.quantity ?? 1,
      unit: params.unit ?? "meal",
      nutrients: cleanNutrients(estimate.total_nutrients),
      confidence: params.confidence ?? estimate.confidence,
      source_trace: "estimate",
      tags: params.tags,
      wellness_context_refs: [
        ...params.wellness_context_refs,
        ...expanded.matches.map((match) => `nourish-memory:${match.id}`),
      ],
    };

    if (params.timestamp !== undefined) {
      input.timestamp = params.timestamp;
    }
    if (params.grams_estimate !== undefined) {
      input.grams_estimate = params.grams_estimate;
    } else {
      const grams = sumGrams(estimate.items);
      if (grams !== undefined) {
        input.grams_estimate = grams;
      }
    }
    if (params.notes !== undefined) {
      input.notes = params.notes;
    }

    return input;
  }

  // Explicit-data path. May still have `text` (used as label/name override).
  const customFood = asFoodItem(params.custom_food);
  const providedFood = asFoodItem(params.food);
  const customFoodRef = foodRefFromUnknown(params.custom_food);
  const inputFoodRef = params.food_ref ?? foodRefFromUnknown(params.food) ?? customFoodRef;
  const resolvedFood = customFood ?? providedFood ?? await resolveFoodRef(inputFoodRef);

  // If text is present but no food_ref was derivable, synthesize a manual food_ref
  // using the text as the human-readable label so the entry isn't anonymous.
  const foodRef =
    inputFoodRef ??
    foodRefFromFood(resolvedFood) ??
    (text !== undefined
      ? {
          source: "manual" as const,
          source_id: stableEstimateId(text),
          name: text,
        }
      : undefined);

  const nutrients =
    params.nutrients ??
    nutrientsForLoggedFood(resolvedFood, params) ??
    nutrientsFromCustomShape(params.custom_food, params) ??
    nutrientsFromCustomShape(params.food, params);
  const clean = cleanNutrients(nutrients);

  if (!hasMeaningfulNutrients(clean)) {
    throw new Error(
      "Non-text intake logs require meaningful nutrients. Provide nutrients, custom_food.nutrients_per_100g, or a food object with nutrients.",
    );
  }

  const input: AddIntakeEntryInput = {
    meal_type: params.meal_type,
    quantity: params.quantity ?? 1,
    unit: params.unit ?? "serving",
    nutrients: clean,
    confidence: params.confidence ?? resolvedFood?.data_quality.confidence ?? 0.5,
    source_trace: sourceTraceFor(foodRef, resolvedFood),
    tags: params.tags,
    wellness_context_refs: params.wellness_context_refs,
  };

  if (params.timestamp !== undefined) {
    input.timestamp = params.timestamp;
  }
  if (foodRef !== undefined) {
    input.food_ref = foodRef;
  }
  const storedCustomFood = customFood ?? providedFood;
  if (storedCustomFood !== undefined) {
    input.custom_food = storedCustomFood;
  }
  const grams = params.grams_estimate ?? gramsForLoggedFood(resolvedFood, params.quantity, params.unit);
  if (grams !== undefined) {
    input.grams_estimate = grams;
  }
  // Preserve text in notes if provided alongside explicit food data, so the
  // user-facing label isn't lost.
  if (params.notes !== undefined) {
    input.notes = params.notes;
  } else if (text !== undefined && foodRef?.name !== text) {
    input.notes = text;
  }

  return input;
}

async function resolveFoodRef(foodRef: IntakeEntry["food_ref"] | undefined): Promise<FoodItem | undefined> {
  if (foodRef === undefined) {
    return undefined;
  }

  if (foodRef.source === "usda") {
    return getUsdaFood(foodRef.source_id);
  }

  if (foodRef.source === "open_food_facts") {
    return (await lookupOpenFoodFactsBarcode(foodRef.source_id)).food;
  }

  if (foodRef.source === "taco") {
    return getTacoFood(foodRef.source_id);
  }

  return undefined;
}

async function getFoodBySource(
  source: "usda" | "open_food_facts" | "taco",
  sourceId: string,
): Promise<{ provider: "usda" | "open_food_facts" | "taco"; food: FoodItem }> {
  if (source === "usda") {
    return { provider: "usda", food: await getUsdaFood(sourceId) };
  }
  if (source === "open_food_facts") {
    return lookupOpenFoodFactsBarcode(sourceId);
  }
  const food = await getTacoFood(sourceId);
  if (food === undefined) {
    throw new Error(`TACO food not found for source_id ${sourceId}`);
  }
  return { provider: "taco", food };
}

function nutrientsForLoggedFood(
  food: FoodItem | undefined,
  params: ReturnType<typeof IntakeLogInputSchema.parse>,
): NutrientMap | undefined {
  if (food === undefined) {
    return undefined;
  }

  const grams = params.grams_estimate ?? gramsForLoggedFood(food, params.quantity, params.unit);
  if (grams !== undefined) {
    return nutrientsForGrams(food.nutrients_per_100g, grams);
  }

  return food.nutrients_per_serving ?? food.nutrients_per_100g;
}

function gramsForLoggedFood(
  food: FoodItem | undefined,
  quantity: number | undefined,
  unit: string | undefined,
): number | undefined {
  if (food === undefined) {
    return undefined;
  }

  const servingGrams = food.serving?.grams ?? food.available_portions[0]?.grams;
  return gramsForQuantity(quantity ?? 1, unit ?? "serving", servingGrams);
}

function nutrientsFromUnknown(value: unknown): NutrientMap | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (isRecord(value.nutrients_per_100g)) {
    return cleanNutrients(value.nutrients_per_100g);
  }

  if (isRecord(value.nutrients)) {
    return cleanNutrients(value.nutrients);
  }

  return undefined;
}

/**
 * Like `nutrientsFromUnknown` but scales `nutrients_per_100g` to the user-supplied
 * `grams_estimate` (or to grams derived from `serving.grams` × quantity). Without
 * scaling, a 60g portion of a 100g-referenced custom food would log full 100g
 * nutrient values (N-002 bug).
 *
 * Precedence:
 *   1. nutrients_per_serving — used as-is
 *   2. nutrients_per_100g + grams known — scaled via nutrientsForGrams
 *   3. nutrients_per_100g without grams — used as-is (best effort, same as before)
 *   4. nutrients — used as-is
 */
function nutrientsFromCustomShape(
  value: unknown,
  params: ReturnType<typeof IntakeLogInputSchema.parse>,
): NutrientMap | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (isRecord(value.nutrients_per_serving)) {
    return cleanNutrients(value.nutrients_per_serving);
  }

  if (isRecord(value.nutrients_per_100g)) {
    const grams = gramsForCustomShape(value, params);
    if (grams !== undefined) {
      return cleanNutrients(nutrientsForGrams(value.nutrients_per_100g as NutrientMap, grams));
    }
    return cleanNutrients(value.nutrients_per_100g);
  }

  if (isRecord(value.nutrients)) {
    return cleanNutrients(value.nutrients);
  }

  return undefined;
}

/**
 * Resolve the gram weight for a `custom_food`-shaped value, given user
 * intake params. Prefers explicit `grams_estimate`, then falls back to
 * `serving.grams × quantity`, then to `available_portions[0].grams × quantity`.
 */
function gramsForCustomShape(
  value: UnknownRecord,
  params: ReturnType<typeof IntakeLogInputSchema.parse>,
): number | undefined {
  if (params.grams_estimate !== undefined) {
    return params.grams_estimate;
  }

  const servingGrams =
    (isRecord(value.serving) && typeof value.serving.grams === "number"
      ? value.serving.grams
      : undefined) ??
    (Array.isArray(value.available_portions) &&
    isRecord(value.available_portions[0]) &&
    typeof (value.available_portions[0] as UnknownRecord).grams === "number"
      ? ((value.available_portions[0] as UnknownRecord).grams as number)
      : undefined);

  if (servingGrams === undefined) {
    return undefined;
  }

  return gramsForQuantity(params.quantity ?? 1, params.unit ?? "serving", servingGrams);
}

function hasMeaningfulNutrients(nutrients: NutrientMap): boolean {
  return Object.values(nutrients).some((value) => typeof value === "number" && Number.isFinite(value));
}

function sourceTraceFor(foodRef: IntakeEntry["food_ref"], customFood: FoodItem | undefined): IntakeEntry["source_trace"] {
  if (customFood !== undefined || foodRef?.source === "usda" || foodRef?.source === "taco") {
    return "exact_food";
  }

  if (foodRef?.source === "open_food_facts") {
    return "barcode";
  }

  if (foodRef?.source === "estimate") {
    return "estimate";
  }

  return "manual";
}

function cleanNutrients(nutrients: Partial<Record<keyof NutrientMap, number | undefined>> | undefined): NutrientMap {
  if (nutrients === undefined) {
    return {};
  }

  const clean: NutrientMap = {};

  for (const key of Object.keys(nutrients) as Array<keyof NutrientMap>) {
    const value = nutrients[key];
    if (value !== undefined) {
      clean[key] = value;
    }
  }

  return clean;
}

function foodRefFromFood(food: FoodItem | undefined): IntakeEntry["food_ref"] | undefined {
  if (food === undefined) {
    return undefined;
  }

  return {
    source: food.source,
    source_id: food.source_id,
    name: food.name,
  };
}

function foodRefFromUnknown(food: unknown): IntakeEntry["food_ref"] | undefined {
  if (!isRecord(food)) {
    return undefined;
  }

  const source = food.source;
  const sourceId = food.source_id;
  const name = food.name;

  if (!isProviderSource(source) || typeof sourceId !== "string" || typeof name !== "string") {
    return undefined;
  }

  return {
    source,
    source_id: sourceId,
    name,
  };
}

function asFoodItem(value: unknown): FoodItem | undefined {
  return isRecord(value) &&
    typeof value.id === "string" &&
    isProviderSource(value.source) &&
    typeof value.source_id === "string" &&
    typeof value.name === "string" &&
    isRecord(value.nutrients_per_100g) &&
    Array.isArray(value.available_portions) &&
    isRecord(value.data_quality) &&
    isRecord(value.license)
    ? (value as unknown as FoodItem)
    : undefined;
}

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isProviderSource(value: unknown): value is ProviderSource {
  return value === "usda" || value === "open_food_facts" || value === "manual" || value === "estimate" || value === "taco";
}

function sumGrams(items: Array<{ grams: number }>): number | undefined {
  if (items.length === 0) {
    return undefined;
  }

  return items.reduce((total, item) => total + item.grams, 0);
}

function stableEstimateId(text: string): string {
  return `estimate:${Buffer.from(text).toString("base64url").slice(0, 48)}`;
}

// Replaced with the timezone-aware helper. The legacy `${date}T12:00:00.000Z`
// was UTC noon — early morning for users east of UTC, evening for users
// west. See services/local-date.ts.
import { dateToNoonTimestamp as dateToNoonTimestampLocal } from "../services/local-date.js";
function dateToNoonTimestamp(date: string | undefined): string | undefined {
  return dateToNoonTimestampLocal(date);
}

// Compare/trend helpers used by daily_summary (compare_to) and compare_days.
function addDaysToDate(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

const TRACKED_NUTRIENT_KEYS: Array<keyof NutrientMap> = [
  "calories_kcal",
  "protein_g",
  "carbohydrates_g",
  "fat_g",
  "fiber_g",
  "sugar_g",
  "saturated_fat_g",
  "sodium_mg",
];

function nutrientDeltas(
  baseline: NutrientMap,
  current: NutrientMap,
): Record<string, { baseline: number; current: number; delta: number; percent_change?: number }> {
  const deltas: Record<string, { baseline: number; current: number; delta: number; percent_change?: number }> = {};
  for (const key of TRACKED_NUTRIENT_KEYS) {
    const a = (baseline[key] as number | undefined) ?? 0;
    const b = (current[key] as number | undefined) ?? 0;
    if (a === 0 && b === 0) continue;
    const entry: { baseline: number; current: number; delta: number; percent_change?: number } = {
      baseline: a,
      current: b,
      delta: Math.round((b - a) * 100) / 100,
    };
    if (a !== 0) {
      entry.percent_change = Math.round(((b - a) / a) * 1000) / 10;
    }
    deltas[key] = entry;
  }
  return deltas;
}

function averageNutrients(samples: NutrientMap[]): NutrientMap {
  if (samples.length === 0) return {};
  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (const sample of samples) {
    for (const key of TRACKED_NUTRIENT_KEYS) {
      const v = sample[key] as number | undefined;
      if (v !== undefined && Number.isFinite(v)) {
        sums[key] = (sums[key] ?? 0) + v;
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
  }
  const avg: NutrientMap = {};
  for (const key of TRACKED_NUTRIENT_KEYS) {
    if (counts[key] !== undefined && counts[key]! > 0) {
      avg[key] = Math.round((sums[key]! / counts[key]!) * 100) / 100;
    }
  }
  return avg;
}

function meaningfulMealDifferences(
  byMealA: Record<string, NutrientMap>,
  byMealB: Record<string, NutrientMap>,
): Record<string, { calories_kcal_delta: number; protein_g_delta: number }> {
  const out: Record<string, { calories_kcal_delta: number; protein_g_delta: number }> = {};
  const mealTypes = new Set([...Object.keys(byMealA), ...Object.keys(byMealB)]);
  for (const meal of mealTypes) {
    const a = byMealA[meal] ?? {};
    const b = byMealB[meal] ?? {};
    const calorieDelta = ((b.calories_kcal as number | undefined) ?? 0) - ((a.calories_kcal as number | undefined) ?? 0);
    const proteinDelta = ((b.protein_g as number | undefined) ?? 0) - ((a.protein_g as number | undefined) ?? 0);
    // Only include meals with meaningful change (>20 kcal or >2g protein).
    if (Math.abs(calorieDelta) > 20 || Math.abs(proteinDelta) > 2) {
      out[meal] = {
        calories_kcal_delta: Math.round(calorieDelta * 100) / 100,
        protein_g_delta: Math.round(proteinDelta * 100) / 100,
      };
    }
  }
  return out;
}

function toolError(error: unknown, responseFormat: ResponseFormat = "json"): CallToolResult {
  if (error instanceof z.ZodError) {
    return toolResponse(makeValidationError(
      error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code,
      })),
      responseFormat,
    ));
  }

  const message = error instanceof Error ? error.message : String(error);

  return toolResponse(makeError("NOURISH_ERROR", message, responseFormat));
}
