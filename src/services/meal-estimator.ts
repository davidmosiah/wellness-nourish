import type { MealType, NutrientMap } from "../types.js";
import { addNutrients } from "./nutrients.js";
import { gramsForQuantity, nutrientsForGrams } from "./portion-engine.js";

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
    aliases: ["toast", "bread"],
    servingGrams: 30,
    nutrientsPer100g: {
      calories_kcal: 313,
      protein_g: 13,
      carbohydrates_g: 55,
      fat_g: 4,
    },
  },
  {
    canonical: "rice",
    aliases: ["rice", "white rice", "brown rice"],
    servingGrams: 158,
    nutrientsPer100g: {
      calories_kcal: 130,
      protein_g: 2.7,
      carbohydrates_g: 28,
      fat_g: 0.3,
    },
  },
  {
    canonical: "chicken",
    aliases: ["chicken", "chicken breast"],
    servingGrams: 100,
    nutrientsPer100g: {
      calories_kcal: 165,
      protein_g: 31,
      carbohydrates_g: 0,
      fat_g: 3.6,
    },
  },
  {
    canonical: "oatmeal",
    aliases: ["oatmeal", "oats"],
    servingGrams: 234,
    nutrientsPer100g: {
      calories_kcal: 71,
      protein_g: 2.5,
      carbohydrates_g: 12,
      fat_g: 1.5,
      fiber_g: 1.7,
    },
  },
  {
    canonical: "milk",
    aliases: ["milk"],
    servingGrams: 244,
    nutrientsPer100g: {
      calories_kcal: 61,
      protein_g: 3.2,
      carbohydrates_g: 4.8,
      fat_g: 3.3,
    },
  },
  {
    canonical: "apple",
    aliases: ["apple", "apples"],
    servingGrams: 182,
    nutrientsPer100g: {
      calories_kcal: 52,
      protein_g: 0.3,
      carbohydrates_g: 13.8,
      fat_g: 0.2,
      fiber_g: 2.4,
      sugar_g: 10.4,
    },
  },
];

const FOOD_BY_ALIAS = new Map<string, SimpleFood>(
  SIMPLE_FOODS.flatMap((food) => food.aliases.map((alias) => [alias, food] as const)),
);

const QUANTITY_PATTERN = String.raw`\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?`;
const UNIT_PATTERN = [
  "tablespoons",
  "tablespoon",
  "teaspoons",
  "teaspoon",
  "servings",
  "serving",
  "slices",
  "slice",
  "pieces",
  "piece",
  "cups",
  "cup",
  "tbsp",
  "tsp",
  "ounces",
  "ounce",
  "oz",
  "grams",
  "gram",
  "g",
  "kg",
  "lb",
  "ml",
  "l",
].join("|");
const FOOD_PATTERN = new RegExp(
  String.raw`(?:^|(?<=[^\p{L}\p{N}_\/-]))(?:(${QUANTITY_PATTERN})\s+)?(?:(${UNIT_PATTERN})\s+)?(${[...FOOD_BY_ALIAS.keys()]
    .sort((a, b) => b.length - a.length)
    .join("|")})(?=$|[^\p{L}\p{N}_-])`,
  "giu",
);

export async function estimateMeal(input: {
  text: string;
  meal_type: MealType;
  locale: string;
}): Promise<MealEstimate> {
  const items: EstimatedMealItem[] = [];

  for (const match of input.text.matchAll(FOOD_PATTERN)) {
    const quantity = parseQuantity(match[1]);
    const unit = match[2]?.toLowerCase();
    const alias = match[3]?.toLowerCase();
    const food = alias === undefined ? undefined : FOOD_BY_ALIAS.get(alias);

    if (food === undefined) {
      continue;
    }

    const grams = unit === undefined
      ? food.servingGrams * quantity
      : (gramsForQuantity(quantity, unit, food.servingGrams) ?? food.servingGrams * quantity);
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

  const [numerator, denominator] = raw.split("/");
  if (numerator === undefined) {
    return 1;
  }

  const quantity =
    denominator === undefined
      ? Number.parseFloat(numerator)
      : Number.parseFloat(numerator) / Number.parseFloat(denominator);

  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}
