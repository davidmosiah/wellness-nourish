import type { NutrientMap } from "../types.js";
import { scaleNutrients } from "./nutrients.js";

export const UNIT_TO_GRAMS: Readonly<Record<string, number>> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  oz: 28.35,
  ounce: 28.35,
  ounces: 28.35,
  lb: 453.59,
  ml: 1,
  l: 1000,
};

export function gramsForQuantity(
  quantity: number,
  unit: string,
  servingGrams?: number,
): number | undefined {
  if (!Number.isFinite(quantity)) {
    return undefined;
  }

  const normalizedUnit = unit.trim().toLowerCase();
  if (normalizedUnit === "serving") {
    return typeof servingGrams === "number" && Number.isFinite(servingGrams)
      ? roundGrams(quantity * servingGrams)
      : undefined;
  }

  const gramsPerUnit = UNIT_TO_GRAMS[normalizedUnit];
  return gramsPerUnit === undefined ? undefined : roundGrams(quantity * gramsPerUnit);
}

export function nutrientsForGrams(per100g: NutrientMap, grams: number): NutrientMap {
  return scaleNutrients(per100g, grams / 100);
}

function roundGrams(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
