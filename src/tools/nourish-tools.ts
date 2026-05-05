import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import {
  AgentManifestInputSchema,
  BarcodeImageDecodeInputSchema,
  BarcodeImageLookupInputSchema,
  BarcodeLookupInputSchema,
  ClearDayInputSchema,
  ExportInputSchema,
  FoodGetInputSchema,
  FoodSearchInputSchema,
  GoalsSetInputSchema,
  HydrationLogInputSchema,
  IntakeDeleteInputSchema,
  IntakeListInputSchema,
  IntakeLogInputSchema,
  IntakeUpdateInputSchema,
  MealEstimateInputSchema,
  PhotoMealEstimateInputSchema,
  ResponseOnlyInputSchema,
  SummaryInputSchema,
  WeeklySummaryInputSchema,
} from "../schemas/common.js";
import { getUsdaFood, searchUsdaFoods } from "../providers/usda.js";
import { lookupOpenFoodFactsBarcode } from "../providers/open-food-facts.js";
import { buildAgentManifest } from "../services/agent-manifest.js";
import { buildCapabilities } from "../services/capabilities.js";
import { buildConnectionStatus } from "../services/connection-status.js";
import { makeError, makeResponse, bulletList, compactTable, type McpTextResponse } from "../services/format.js";
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
import { buildHydrationSummary, logWater } from "../services/hydration-store.js";
import { getGoals, updateGoals } from "../services/goals-store.js";
import { decodeBarcodeImage } from "../services/image-decoder.js";
import { estimateMeal } from "../services/meal-estimator.js";
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
      description: "Search USDA FoodData Central foods by query and return compact nutrition/source data.",
      inputSchema: FoodSearchInputSchema.shape,
      annotations: readOnlyOpenWorldAnnotation(),
    },
    async (input) => {
      try {
        const params = FoodSearchInputSchema.parse(input);
        const result = await searchUsdaFoods(params.query, params.limit);
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
      description: "Fetch a USDA food by source_id or an Open Food Facts food by barcode source_id.",
      inputSchema: FoodGetInputSchema.shape,
      annotations: readOnlyOpenWorldAnnotation(),
    },
    async (input) => {
      try {
        const params = FoodGetInputSchema.parse(input);
        const result =
          params.source === "usda"
            ? { provider: "usda" as const, food: await getUsdaFood(params.source_id) }
            : await lookupOpenFoodFactsBarcode(params.source_id);

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
      description: "Estimate nutrition for a short meal text using local deterministic defaults.",
      inputSchema: MealEstimateInputSchema.shape,
      annotations: readOnlyAnnotation(),
    },
    async (input) => {
      try {
        const params = MealEstimateInputSchema.parse(input);
        const estimate = await estimateMeal(params);

        return toolResponse(makeResponse(estimate, params.response_format));
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
    "nourish_log_intake",
    {
      title: "Log intake",
      description: "Log an intake entry only after explicit user intent, using meal text or structured food data.",
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
          return toolResponse(makeError("explicit_user_intent must be true to log intake."));
        }

        const entry = await addIntakeEntry(await buildIntakeEntryInput(params));

        return toolResponse(makeResponse(entry, params.response_format));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_update_intake",
    {
      title: "Update intake",
      description: "Update non-nutrition metadata for a local intake entry by id.",
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
      description: "List local intake entries, optionally filtered by date.",
      inputSchema: IntakeListInputSchema.shape,
      annotations: readOnlyAnnotation(),
    },
    async (input) => {
      try {
        const params = IntakeListInputSchema.parse(input);
        const entries = await listIntakeEntries(params.date === undefined ? {} : { date: params.date });
        const markdown = compactIntakeTable(entries);

        return toolResponse(makeResponse({ entries }, params.response_format, markdown));
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
        const result = await clearIntakeDay(params.date);

        return toolResponse(makeResponse(result, params.response_format));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "nourish_log_water",
    {
      title: "Log water",
      description: "Log local hydration in milliliters after explicit user intent.",
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
      description: "Set local calorie, macro, and hydration goals after explicit user intent.",
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
        const result = await updateGoals({
          ...(params.daily === undefined ? {} : { daily: cleanNutrients(params.daily) }),
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
      description: "Summarize local intake totals, confidence, and source coverage for a date.",
      inputSchema: SummaryInputSchema.shape,
      annotations: readOnlyAnnotation(),
    },
    async (input) => {
      try {
        const params = SummaryInputSchema.parse(input);
        const summary = await buildDailySummary(params.date);

        return toolResponse(makeResponse(summary, params.response_format));
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

function readOnlyOpenWorldAnnotation() {
  return {
    ...readOnlyAnnotation(),
    openWorldHint: true,
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

async function buildIntakeEntryInput(
  params: ReturnType<typeof IntakeLogInputSchema.parse>,
): Promise<AddIntakeEntryInput> {
  if (params.text !== undefined) {
    const estimate = await estimateMeal({
      text: params.text,
      meal_type: params.meal_type,
      locale: "en-US",
    });

    const input: AddIntakeEntryInput = {
      meal_type: params.meal_type,
      food_ref: {
        source: "estimate",
        source_id: stableEstimateId(params.text),
        name: params.text,
      },
      quantity: params.quantity ?? 1,
      unit: params.unit ?? "meal",
      nutrients: cleanNutrients(estimate.total_nutrients),
      confidence: params.confidence ?? estimate.confidence,
      source_trace: "estimate",
      tags: params.tags,
      wellness_context_refs: params.wellness_context_refs,
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

  const customFood = asFoodItem(params.custom_food);
  const customFoodRef = foodRefFromUnknown(params.custom_food);
  const foodNutrients = nutrientsFromUnknown(params.food);
  const foodRef =
    params.food_ref ?? foodRefFromUnknown(params.food) ?? foodRefFromFood(customFood) ?? customFoodRef;
  const nutrients =
    params.nutrients ?? bestFoodNutrients(customFood) ?? nutrientsFromUnknown(params.custom_food) ?? foodNutrients;
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
    confidence: params.confidence ?? customFood?.data_quality.confidence ?? 0.5,
    source_trace: sourceTraceFor(foodRef, customFood),
    tags: params.tags,
    wellness_context_refs: params.wellness_context_refs,
  };

  if (params.timestamp !== undefined) {
    input.timestamp = params.timestamp;
  }
  if (foodRef !== undefined) {
    input.food_ref = foodRef;
  }
  if (customFood !== undefined) {
    input.custom_food = customFood;
  }
  if (params.grams_estimate !== undefined) {
    input.grams_estimate = params.grams_estimate;
  }
  if (params.notes !== undefined) {
    input.notes = params.notes;
  }

  return input;
}

function bestFoodNutrients(food: FoodItem | undefined): NutrientMap | undefined {
  return food?.nutrients_per_serving ?? food?.nutrients_per_100g;
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

function hasMeaningfulNutrients(nutrients: NutrientMap): boolean {
  return Object.values(nutrients).some((value) => typeof value === "number" && Number.isFinite(value));
}

function sourceTraceFor(foodRef: IntakeEntry["food_ref"], customFood: FoodItem | undefined): IntakeEntry["source_trace"] {
  if (customFood !== undefined || foodRef?.source === "usda") {
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
  return value === "usda" || value === "open_food_facts" || value === "manual" || value === "estimate";
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

function dateToNoonTimestamp(date: string | undefined): string | undefined {
  return date === undefined ? undefined : `${date}T12:00:00.000Z`;
}

function toolError(error: unknown, responseFormat: ResponseFormat = "json"): CallToolResult {
  const message = error instanceof Error ? error.message : String(error);

  return toolResponse(makeError("NOURISH_ERROR", message, responseFormat));
}
