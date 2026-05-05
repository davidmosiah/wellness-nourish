import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import {
  AgentManifestInputSchema,
  BarcodeLookupInputSchema,
  FoodGetInputSchema,
  FoodSearchInputSchema,
  IntakeDeleteInputSchema,
  IntakeLogInputSchema,
  IntakeUpdateInputSchema,
  MealEstimateInputSchema,
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
  deleteIntakeEntry,
  exportIntakeData,
  updateIntakeEntry,
  type AddIntakeEntryInput,
} from "../services/intake-store.js";
import { estimateMeal } from "../services/meal-estimator.js";
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
      description: "Export local intake JSONL data without provider secrets or tokens.",
      inputSchema: ResponseOnlyInputSchema.shape,
      annotations: readOnlyAnnotation(),
    },
    async (input) => {
      try {
        const params = ResponseOnlyInputSchema.parse(input);
        const jsonl = await exportIntakeData();

        return toolResponse(makeResponse({ jsonl }, params.response_format, jsonl));
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

function toolError(error: unknown, responseFormat: ResponseFormat = "json"): CallToolResult {
  const message = error instanceof Error ? error.message : String(error);

  return toolResponse(makeError("NOURISH_ERROR", message, responseFormat));
}
