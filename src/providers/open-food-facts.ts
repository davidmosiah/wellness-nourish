/// <reference types="node" />

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { OFF_BASE_URL, USER_AGENT } from "../constants.js";
import { foodCompleteness, makeFoodId } from "../services/food-normalization.js";
import { nutrientsForGrams } from "../services/portion-engine.js";
import { roundNutrient } from "../services/nutrients.js";
import { getConfig, getFixtureDir } from "../services/config.js";
import type { FoodItem, NutrientMap } from "../types.js";

type OpenFoodFactsProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  url?: string;
  quantity?: string;
  serving_size?: string;
  serving_quantity?: number;
  nutriments?: Record<string, number | string | undefined>;
};

type OpenFoodFactsResponse = {
  code?: string;
  status?: number;
  product?: OpenFoodFactsProduct;
};

type OpenFoodFactsLookupResult = { food: FoodItem; provider: "open_food_facts" };

const OFF_LICENSE = {
  name: "Open Food Facts ODbL",
  attribution: "Food data sourced from Open Food Facts. Open Food Facts data is available under ODbL.",
  share_alike: true,
  url: "https://world.openfoodfacts.org/",
} as const;

const NUTRIENT_KEYS: Readonly<Record<string, keyof NutrientMap>> = {
  "energy-kcal_100g": "calories_kcal",
  proteins_100g: "protein_g",
  carbohydrates_100g: "carbohydrates_g",
  fat_100g: "fat_g",
  fiber_100g: "fiber_g",
  sugars_100g: "sugar_g",
  "saturated-fat_100g": "saturated_fat_g",
};
const OFF_CACHE = new Map<string, { expires_at: number; result: OpenFoodFactsLookupResult }>();

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

async function readFixture(barcode: string): Promise<OpenFoodFactsResponse> {
  const fixture = JSON.parse(
    await readFile(join(getFixtureDir(), "open-food-facts", "barcode-peanut-butter.json"), "utf8"),
  ) as OpenFoodFactsResponse;

  if (fixture.code !== barcode || fixture.product?.code !== barcode) {
    throw new Error(`Open Food Facts fixture not found for barcode ${barcode}`);
  }

  return fixture;
}

async function fetchBarcode(barcode: string): Promise<OpenFoodFactsResponse> {
  const url = new URL(`${OFF_BASE_URL}/api/v2/product/${encodeURIComponent(barcode)}`);
  url.searchParams.set(
    "fields",
    "code,product_name,brands,url,quantity,serving_size,serving_quantity,nutriments",
  );

  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error(
        "Open Food Facts is rate limiting requests right now. Try again in a few minutes, or provide the product name, label photo, or visible nutrition facts manually.",
      );
    }
    throw new Error(`Open Food Facts request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as OpenFoodFactsResponse;
}

function mapNutrients(nutriments: OpenFoodFactsProduct["nutriments"] = {}): NutrientMap {
  const nutrients: NutrientMap = {};

  for (const [offKey, nutrientKey] of Object.entries(NUTRIENT_KEYS)) {
    const value = finiteNumber(nutriments[offKey]);
    if (value !== undefined) {
      nutrients[nutrientKey] = roundNutrient(value);
    }
  }

  const sodiumGrams = finiteNumber(nutriments.sodium_100g);
  if (sodiumGrams !== undefined) {
    nutrients.sodium_mg = roundNutrient(sodiumGrams * 1000);
  }

  return nutrients;
}

function sourceUrl(product: OpenFoodFactsProduct, sourceId: string): string {
  return product.url ?? `${OFF_BASE_URL}/product/${encodeURIComponent(sourceId)}`;
}

function mapProduct(response: OpenFoodFactsResponse, barcode: string): FoodItem {
  const product = response.product;
  if (product === undefined) {
    throw new Error(`Open Food Facts product not found for barcode ${barcode}`);
  }

  const sourceId = product.code ?? response.code ?? barcode;
  const servingQuantity = finiteNumber(product.serving_quantity);
  const nutrients = mapNutrients(product.nutriments);
  const availablePortions: FoodItem["available_portions"] = [
    {
      label: "100g",
      quantity: 100,
      unit: "g",
      grams: 100,
    },
  ];

  if (servingQuantity !== undefined) {
    availablePortions.push({
      label: product.serving_size ?? "serving",
      quantity: 1,
      unit: "serving",
      grams: roundNutrient(servingQuantity),
    });
  }

  const itemBase: Omit<FoodItem, "data_quality"> = {
    id: makeFoodId("open_food_facts", sourceId),
    source: "open_food_facts" as const,
    source_id: sourceId,
    source_url: sourceUrl(product, sourceId),
    name: product.product_name ?? "Unknown Open Food Facts product",
    barcode,
    available_portions: availablePortions,
    nutrients_per_100g: nutrients,
    license: OFF_LICENSE,
  };

  if (product.brands !== undefined) {
    itemBase.brand = product.brands;
  }

  if (servingQuantity !== undefined) {
    itemBase.serving = {
      quantity: 1,
      unit: "serving",
      grams: roundNutrient(servingQuantity),
    };
    itemBase.nutrients_per_serving = nutrientsForGrams(nutrients, servingQuantity);
  }

  return {
    ...itemBase,
    data_quality: {
      completeness: foodCompleteness(itemBase),
      confidence: 0.75,
      warnings: [],
    },
  };
}

export async function lookupOpenFoodFactsBarcode(
  barcode: string,
): Promise<OpenFoodFactsLookupResult> {
  const config = getConfig();

  if (!config.off_enabled) {
    throw new Error("Open Food Facts provider is disabled");
  }

  const cached = getCachedLookup(barcode);
  let response: OpenFoodFactsResponse;
  try {
    response = config.fixture_mode ? await readFixture(barcode) : await fetchBarcode(barcode);
  } catch (error) {
    if (cached !== undefined && isRateLimitError(error)) {
      return cloneLookupResult(
        cached,
        "Returned cached Open Food Facts result because the provider is rate limiting requests right now.",
      );
    }
    throw error;
  }

  if (response.product === undefined || response.status === 0) {
    throw new Error(`Open Food Facts product not found for barcode ${barcode}`);
  }

  const result: OpenFoodFactsLookupResult = {
    provider: "open_food_facts",
    food: mapProduct(response, barcode),
  };
  setCachedLookup(barcode, result, config.cache_ttl_seconds);

  return cloneLookupResult(result);
}

function getCachedLookup(barcode: string): OpenFoodFactsLookupResult | undefined {
  const cached = OFF_CACHE.get(barcode);
  if (cached === undefined) {
    return undefined;
  }

  if (cached.expires_at <= Date.now()) {
    OFF_CACHE.delete(barcode);
    return undefined;
  }

  return cached.result;
}

function setCachedLookup(barcode: string, result: OpenFoodFactsLookupResult, ttlSeconds: number): void {
  OFF_CACHE.set(barcode, {
    expires_at: Date.now() + Math.max(ttlSeconds, 1) * 1000,
    result: cloneLookupResult(result),
  });
}

function cloneLookupResult(
  result: OpenFoodFactsLookupResult,
  warning?: string,
): OpenFoodFactsLookupResult {
  const food: FoodItem = {
    ...result.food,
    available_portions: result.food.available_portions.map((portion) => ({ ...portion })),
    nutrients_per_100g: { ...result.food.nutrients_per_100g },
    data_quality: {
      ...result.food.data_quality,
      warnings: warning === undefined
        ? [...result.food.data_quality.warnings]
        : [...result.food.data_quality.warnings, warning],
    },
    license: { ...result.food.license },
  };

  if (result.food.serving !== undefined) {
    food.serving = { ...result.food.serving };
  }

  if (result.food.nutrients_per_serving !== undefined) {
    food.nutrients_per_serving = { ...result.food.nutrients_per_serving };
  }

  return {
    provider: result.provider,
    food,
  };
}

function isRateLimitError(error: unknown): boolean {
  return error instanceof Error && /rate limiting|429|Too Many Requests/i.test(error.message);
}
