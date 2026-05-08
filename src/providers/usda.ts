/// <reference types="node" />

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { USDA_BASE_URL, USER_AGENT } from "../constants.js";
import { enrichWithCarbon } from "../services/carbon-enrichment.js";
import { foodCompleteness, makeFoodId } from "../services/food-normalization.js";
import { fetchWithTimeout, NourishHttpError } from "../services/http.js";
import { roundNutrient, scaleNutrients } from "../services/nutrients.js";
import { getConfig, getFixtureDir } from "../services/config.js";
import type { FoodItem, NutrientMap } from "../types.js";

type UsdaSearchFood = {
  fdcId?: number;
  description?: string;
  dataType?: string;
  foodNutrients?: Array<{
    nutrientId?: number;
    value?: number;
  }>;
};

type UsdaSearchResponse = {
  foods?: UsdaSearchFood[];
};

type UsdaFoodDetail = {
  fdcId?: number;
  description?: string;
  dataType?: string;
  foodNutrients?: Array<{
    nutrient?: {
      id?: number;
    };
    nutrientId?: number;
    amount?: number;
    value?: number;
  }>;
  foodPortions?: Array<{
    gramWeight?: number;
    modifier?: string;
    portionDescription?: string;
    measureUnit?: {
      name?: string;
      abbreviation?: string;
    };
  }>;
};

const USDA_ATTRIBUTION = "Food data sourced from USDA FoodData Central.";

const NUTRIENT_KEYS: Partial<Record<number, keyof NutrientMap>> = {
  1008: "calories_kcal",
  1003: "protein_g",
  1005: "carbohydrates_g",
  1004: "fat_g",
  1079: "fiber_g",
  1063: "sugar_g",
  1258: "saturated_fat_g",
  1093: "sodium_mg",
};

async function readFixture<T>(fileName: string): Promise<T> {
  const raw = await readFile(join(getFixtureDir(), "usda", fileName), "utf8");
  return JSON.parse(raw) as T;
}

async function fetchJson<T>(path: string, params: Record<string, string>): Promise<T> {
  const config = getConfig();
  const url = new URL(`${USDA_BASE_URL}${path}`);
  url.searchParams.set("api_key", config.usda_api_key ?? "DEMO_KEY");

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "application/json",
      },
    });
    return (await response.json()) as T;
  } catch (err) {
    if (err instanceof NourishHttpError) {
      // Re-message in the legacy "USDA request failed: ..." shape so callers
      // and existing surface text stay consistent, but enrich with kind/attempts.
      const detail = err.kind === "timeout"
        ? `timed out after ${err.attempts} attempt(s)`
        : err.kind === "rate_limit"
          ? `rate limited after ${err.attempts} attempt(s) (likely DEMO_KEY quota — set FDC_API_KEY)`
          : err.kind === "server_error"
            ? `${err.status} server error after ${err.attempts} attempt(s)`
            : err.kind === "network"
              ? "network failure"
              : `${err.status} ${err.message}`;
      throw new Error(`USDA request failed: ${detail}`);
    }
    throw err;
  }
}

function nutrientAmount(nutrient: {
  nutrientId?: number;
  value?: number;
  amount?: number;
  nutrient?: { id?: number };
}): [keyof NutrientMap, number] | undefined {
  const nutrientId = nutrient.nutrientId ?? nutrient.nutrient?.id;
  const key = nutrientId === undefined ? undefined : NUTRIENT_KEYS[nutrientId];
  const amount = nutrient.amount ?? nutrient.value;

  if (key === undefined || typeof amount !== "number" || !Number.isFinite(amount)) {
    return undefined;
  }

  return [key, roundNutrient(amount)];
}

function mapNutrients(
  foodNutrients: Array<{
    nutrientId?: number;
    value?: number;
    amount?: number;
    nutrient?: { id?: number };
  }> = [],
): NutrientMap {
  const nutrients: NutrientMap = {};

  for (const foodNutrient of foodNutrients) {
    const mapped = nutrientAmount(foodNutrient);
    if (mapped !== undefined) {
      const [key, amount] = mapped;
      nutrients[key] = amount;
    }
  }

  return nutrients;
}

function portionLabel(portion: NonNullable<UsdaFoodDetail["foodPortions"]>[number]): string {
  return (
    portion.modifier ??
    portion.portionDescription ??
    portion.measureUnit?.name ??
    portion.measureUnit?.abbreviation ??
    "serving"
  );
}

function availablePortions(food: UsdaFoodDetail): FoodItem["available_portions"] {
  const portions: FoodItem["available_portions"] = [
    {
      label: "100g",
      quantity: 100,
      unit: "g",
      grams: 100,
    },
  ];

  for (const portion of food.foodPortions ?? []) {
    if (typeof portion.gramWeight === "number" && Number.isFinite(portion.gramWeight)) {
      portions.push({
        label: portionLabel(portion),
        quantity: 1,
        unit: "serving",
        grams: roundNutrient(portion.gramWeight),
      });
    }
  }

  return portions;
}

function sourceUrl(sourceId: string): string {
  return `https://fdc.nal.usda.gov/fdc-app.html#/food-details/${sourceId}/nutrients`;
}

function mapFood(food: UsdaSearchFood | UsdaFoodDetail): FoodItem {
  const sourceId = String(food.fdcId ?? "");
  const name = food.description ?? "Unknown USDA food";
  const nutrients = mapNutrients(food.foodNutrients);
  const portions = availablePortions(food as UsdaFoodDetail);
  const serving = portions[1] ?? portions[0] ?? {
    label: "100g",
    quantity: 100,
    unit: "g",
    grams: 100,
  };
  const servingGrams = serving.grams ?? 100;
  const itemBase = {
    id: makeFoodId("usda", sourceId),
    source: "usda" as const,
    source_id: sourceId,
    source_url: sourceUrl(sourceId),
    name,
    serving: {
      quantity: serving.quantity,
      unit: serving.unit,
      grams: servingGrams,
    },
    available_portions: portions,
    nutrients_per_100g: nutrients,
    nutrients_per_serving:
      scaleNutrients(nutrients, servingGrams / 100),
    license: {
      name: "USDA FoodData Central",
      attribution: USDA_ATTRIBUTION,
      share_alike: false,
      url: "https://fdc.nal.usda.gov/",
    },
  };

  return {
    ...itemBase,
    data_quality: {
      completeness: foodCompleteness(itemBase),
      confidence: 0.9,
      warnings: [],
    },
  };
}

export async function searchUsdaFoods(
  query: string,
  limit = 10,
): Promise<{ foods: FoodItem[]; provider: "usda" }> {
  const config = getConfig();
  const search =
    config.fixture_mode
      ? await readFixture<UsdaSearchResponse>("search-banana.json")
      : await fetchJson<UsdaSearchResponse>("/foods/search", {
          query,
          pageSize: String(Math.min(limit, config.max_results)),
        });

  return {
    provider: "usda",
    foods: rankSearchFoods(query, search.foods ?? []).slice(0, limit).map(mapFood).map(enrichWithCarbon),
  };
}

export async function getUsdaFood(sourceId: string): Promise<FoodItem> {
  const config = getConfig();
  const food = config.fixture_mode
    ? await readFixture<UsdaFoodDetail>("food-banana.json")
    : await fetchJson<UsdaFoodDetail>(`/food/${encodeURIComponent(sourceId)}`, {});

  if (config.fixture_mode && String(food.fdcId) !== sourceId) {
    throw new Error(`USDA fixture not found for source_id ${sourceId}`);
  }

  return enrichWithCarbon(mapFood(food));
}

function rankSearchFoods(query: string, foods: UsdaSearchFood[]): UsdaSearchFood[] {
  return [...foods].sort((left, right) => foodSearchScore(query, left) - foodSearchScore(query, right));
}

function foodSearchScore(query: string, food: UsdaSearchFood): number {
  const description = (food.description ?? "").toLowerCase();
  const dataType = (food.dataType ?? "").toLowerCase();
  const normalizedQuery = query.toLowerCase().trim();
  let score = 0;

  if (dataType.includes("branded")) {
    score += 60;
  }
  if (dataType.includes("foundation")) {
    score -= 12;
  }
  if (dataType.includes("sr legacy")) {
    score -= 10;
  }
  if (dataType.includes("survey")) {
    score -= 6;
  }

  if (description === normalizedQuery || description === `${normalizedQuery}s`) {
    score -= 4;
  }
  if (description.includes(", raw") && !normalizedQuery.includes("cooked") && !normalizedQuery.includes("cozido")) {
    score -= 8;
  }
  if ((normalizedQuery.includes("cooked") || normalizedQuery.includes("cozido")) && description.includes("cooked")) {
    score -= 8;
  }
  if (/^[A-Z0-9\s,.-]+$/.test(food.description ?? "") && dataType.includes("branded")) {
    score += 8;
  }

  return score;
}
