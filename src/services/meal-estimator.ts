import type { MealType, NutrientMap } from "../types.js";
import { addNutrients } from "./nutrients.js";
import { nutrientsForGrams } from "./portion-engine.js";

interface SimpleFood {
  canonical: string;
  aliases: string[];
  servingGrams: number;
  nutrientsPer100g: NutrientMap;
}

export interface EstimatedMealItem {
  name: string;
  quantity: number;
  grams: number;
  nutrients: NutrientMap;
}

export interface MealEstimate {
  text: string;
  locale: string;
  meal_type: MealType;
  items: EstimatedMealItem[];
  total_nutrients: NutrientMap;
  confidence: number;
  unresolved: string[];
  warnings: string[];
}

const SIMPLE_FOODS: readonly SimpleFood[] = [
  {
    canonical: "egg",
    aliases: ["eggs", "egg"],
    servingGrams: 50,
    nutrientsPer100g: {
      calories_kcal: 143,
      protein_g: 12.6,
      carbohydrates_g: 0.7,
      fat_g: 9.5,
    },
  },
  {
    canonical: "banana",
    aliases: ["banana"],
    servingGrams: 118,
    nutrientsPer100g: {
      calories_kcal: 89,
      protein_g: 1.09,
      carbohydrates_g: 22.84,
      fat_g: 0.33,
      fiber_g: 2.6,
      sugar_g: 12.23,
    },
  },
  {
    canonical: "toast",
    aliases: ["toast"],
    servingGrams: 30,
    nutrientsPer100g: {
      calories_kcal: 313,
      protein_g: 13,
      carbohydrates_g: 55,
      fat_g: 4,
    },
  },
];

const FOOD_BY_ALIAS = new Map<string, SimpleFood>(
  SIMPLE_FOODS.flatMap((food) => food.aliases.map((alias) => [alias, food] as const)),
);

const FOOD_PATTERN = new RegExp(
  String.raw`\b(?:(\d+(?:\.\d+)?)\s+)?(${[...FOOD_BY_ALIAS.keys()]
    .sort((a, b) => b.length - a.length)
    .join("|")})\b`,
  "gi",
);

export async function estimateMeal(input: {
  text: string;
  meal_type: MealType;
  locale: string;
}): Promise<MealEstimate> {
  const items: EstimatedMealItem[] = [];

  for (const match of input.text.matchAll(FOOD_PATTERN)) {
    const quantity = parseQuantity(match[1]);
    const alias = match[2]?.toLowerCase();
    const food = alias === undefined ? undefined : FOOD_BY_ALIAS.get(alias);

    if (food === undefined) {
      continue;
    }

    const grams = food.servingGrams * quantity;
    items.push({
      name: food.canonical,
      quantity,
      grams,
      nutrients: nutrientsForGrams(food.nutrientsPer100g, grams),
    });
  }

  const foundAny = items.length > 0;

  return {
    text: input.text,
    locale: input.locale,
    meal_type: input.meal_type,
    items,
    total_nutrients: addNutrients(items.map((item) => item.nutrients)),
    confidence: foundAny ? 0.55 : 0.2,
    unresolved: foundAny ? [] : [input.text],
    warnings: [
      foundAny
        ? "Nutrition values are estimates from simple food defaults."
        : "No simple foods matched; nutrition estimate is incomplete.",
    ],
  };
}

function parseQuantity(raw: string | undefined): number {
  if (raw === undefined) {
    return 1;
  }

  const quantity = Number.parseFloat(raw);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}
