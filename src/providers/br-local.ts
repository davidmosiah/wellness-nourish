import { foodCompleteness, makeFoodId } from "../services/food-normalization.js";
import { listSimpleFoods, type SimpleFood } from "../services/meal-estimator.js";
import { nutrientsForGrams } from "../services/portion-engine.js";
import type { FoodItem } from "../types.js";

const BR_LOCAL_LICENSE = {
  name: "Nourish local Brazilian estimates",
  attribution: "Nourish local Brazilian food estimates. Values are approximate and should be confirmed for critical use.",
  share_alike: false,
  url: "https://wellness.delx.ai/nutrition",
} as const;

export interface BrazilianLocalSearchResult {
  provider: "br_local";
  foods: FoodItem[];
  warnings: string[];
}

export async function searchBrazilianLocalFoods(
  query: string,
  limit = 10,
): Promise<BrazilianLocalSearchResult> {
  const normalizedQuery = normalizeForSearch(query);
  const foods = listSimpleFoods()
    .map((food) => ({
      food,
      score: localFoodScore(normalizedQuery, food),
    }))
    .filter((entry) => entry.score < 100)
    .sort((left, right) => left.score - right.score)
    .slice(0, limit)
    .map((entry) => mapSimpleFood(entry.food));

  return {
    provider: "br_local",
    foods,
    warnings: [
      "Brazilian local catalog values are deterministic estimates, not a full TBCA/TACO import.",
    ],
  };
}

function mapSimpleFood(food: SimpleFood): FoodItem {
  const sourceId = `br-local:${normalizeForId(food.canonical)}`;
  const itemBase: Omit<FoodItem, "data_quality"> = {
    id: makeFoodId("estimate", sourceId),
    source: "estimate",
    source_id: sourceId,
    source_url: "https://wellness.delx.ai/nutrition",
    name: food.displayNamePtBr ?? food.canonical,
    display_name_pt_br: food.displayNamePtBr ?? food.canonical,
    locale: "pt-BR",
    serving: {
      quantity: 1,
      unit: "serving",
      grams: food.servingGrams,
    },
    available_portions: [
      {
        label: "100g",
        quantity: 100,
        unit: "g",
        grams: 100,
      },
      {
        label: "serving",
        quantity: 1,
        unit: "serving",
        grams: food.servingGrams,
      },
    ],
    nutrients_per_100g: food.nutrientsPer100g,
    nutrients_per_serving: nutrientsForGrams(food.nutrientsPer100g, food.servingGrams),
    license: BR_LOCAL_LICENSE,
  };

  return {
    ...itemBase,
    data_quality: {
      completeness: foodCompleteness(itemBase),
      confidence: 0.65,
      warnings: [
        "Local Brazilian estimate; prefer barcode, label, USDA, or confirmed nutrition data when available.",
      ],
    },
  };
}

function localFoodScore(normalizedQuery: string, food: SimpleFood): number {
  const names = [food.canonical, ...food.aliases].map(normalizeForSearch);
  if (names.includes(normalizedQuery)) {
    return 0;
  }

  if (names.some((name) => name.startsWith(normalizedQuery))) {
    return 10;
  }

  if (names.some((name) => name.includes(normalizedQuery) || normalizedQuery.includes(name))) {
    return 25;
  }

  return 100;
}

function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function normalizeForId(value: string): string {
  return normalizeForSearch(value).replace(/\s+/gu, "-");
}
