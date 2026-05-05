import type { FoodItem } from "../types.js";

export function foodCompleteness(
  food: Pick<FoodItem, "nutrients_per_100g" | "serving" | "barcode">,
): "low" | "medium" | "high" {
  const numericNutrientCount = Object.values(food.nutrients_per_100g).filter((value) =>
    Number.isFinite(value),
  ).length;

  if (numericNutrientCount >= 4 && food.serving !== undefined && food.barcode !== undefined) {
    return "high";
  }

  if (numericNutrientCount >= 3) {
    return "medium";
  }

  return "low";
}

export function makeFoodId(source: string, sourceId: string): string {
  return `${source}:${sourceId}`;
}
