import { TACO_FOODS, TACO_LICENSE, type TacoFood } from "../data/taco-foods.js";
import { foodCompleteness, makeFoodId } from "../services/food-normalization.js";
import { nutrientsForGrams } from "../services/portion-engine.js";
import { enrichWithCarbon } from "../services/carbon-enrichment.js";
import type { FoodItem } from "../types.js";

/**
 * TACO provider — searches the curated subset of the TACO 4 (UNICAMP/NEPA)
 * Brazilian food composition table (curated subset; full ingest planned).
 *
 * Search ranks by:
 *   1. Exact alias match (highest)
 *   2. All query tokens present in name_pt or aliases
 *   3. Partial match (downgraded)
 *
 * Diacritics are normalized so "açai" matches "Açaí" and "feijao" matches
 * "feijão". Each returned FoodItem is auto-enriched with carbon data when
 * a match exists in the carbon dataset.
 */

export interface TacoSearchResult {
  provider: "taco";
  foods: FoodItem[];
  warnings: string[];
}

export async function searchTacoFoods(query: string, limit = 10): Promise<TacoSearchResult> {
  const normalized = normalize(query);
  const tokens = normalized.split(/\s+/).filter((token) => token.length > 1);

  const scored = TACO_FOODS.map((food) => ({
    food,
    score: scoreFood(normalized, tokens, food),
  }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => mapTacoFood(entry.food));

  return {
    provider: "taco",
    foods: scored,
    warnings: scored.length === 0
      ? [`No TACO foods matched. The TACO 4 curated subset covers ${tacoDatasetSize()} staple Brazilian foods.`]
      : [],
  };
}

export async function getTacoFood(sourceId: string): Promise<FoodItem | undefined> {
  // sourceId format: "taco:<taco_id>"
  const tacoId = Number(sourceId.replace(/^taco:/, ""));
  const food = TACO_FOODS.find((entry) => entry.taco_id === tacoId);
  return food === undefined ? undefined : mapTacoFood(food);
}

function scoreFood(normalizedQuery: string, queryTokens: string[], food: TacoFood): number {
  const candidates = [
    food.name_pt,
    food.name_en,
    ...food.aliases,
  ].map(normalize);

  // Exact match — strongest signal.
  if (candidates.includes(normalizedQuery)) return 1000;

  // Alias is a prefix of query OR query is prefix of alias.
  for (const candidate of candidates) {
    if (candidate.startsWith(normalizedQuery) || normalizedQuery.startsWith(candidate)) {
      return 500;
    }
  }

  // All query tokens are in some candidate.
  if (queryTokens.length > 0) {
    for (const candidate of candidates) {
      const hits = queryTokens.filter((token) => candidate.includes(token)).length;
      if (hits === queryTokens.length) return 100 + hits;
      if (hits > 0) return 10 * hits;
    }
  }

  return 0;
}

function mapTacoFood(food: TacoFood): FoodItem {
  const sourceId = `taco:${food.taco_id}`;
  const itemBase: Omit<FoodItem, "data_quality"> = {
    id: makeFoodId("taco", sourceId),
    source: "taco",
    source_id: sourceId,
    source_url: TACO_LICENSE.url,
    name: food.name_pt,
    locale: "pt-BR",
    serving: {
      quantity: 1,
      unit: "serving",
      grams: food.common_serving.grams,
    },
    available_portions: [
      { label: "100g", quantity: 100, unit: "g", grams: 100 },
      {
        label: food.common_serving.label_pt,
        quantity: 1,
        unit: "serving",
        grams: food.common_serving.grams,
      },
    ],
    nutrients_per_100g: food.nutrients_per_100g,
    nutrients_per_serving: nutrientsForGrams(food.nutrients_per_100g, food.common_serving.grams),
    license: TACO_LICENSE,
  };

  const item: FoodItem = {
    ...itemBase,
    data_quality: {
      completeness: foodCompleteness(itemBase),
      confidence: 0.85, // Government laboratory analysis — high confidence.
      warnings: [],
    },
  };

  // Auto-enrich with carbon footprint when available.
  return enrichWithCarbon(item);
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[,;:.!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Exposed for capabilities reporting. */
export function tacoDatasetSize(): number {
  return TACO_FOODS.length;
}
