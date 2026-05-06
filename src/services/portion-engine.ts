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
  cup: 240,
  cups: 240,
  "xícara": 240,
  "xícaras": 240,
  xicara: 240,
  xicaras: 240,
  tbsp: 15,
  tablespoon: 15,
  tablespoons: 15,
  colher: 15,
  colheres: 15,
  "colher de sopa": 15,
  "colheres de sopa": 15,
  fatia: 50,
  fatias: 50,
  tsp: 5,
  teaspoon: 5,
  teaspoons: 5,
  slice: 30,
  slices: 30,
  piece: 1,
  pieces: 1,
  unidade: 1,
  unidades: 1,
  concha: 100,
  conchas: 100,
  prato: 350,
  pratos: 350,
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
  if (normalizedUnit === "serving" || normalizedUnit === "servings") {
    return typeof servingGrams === "number" && Number.isFinite(servingGrams)
      ? roundGrams(quantity * servingGrams)
      : undefined;
  }

  if (normalizedUnit === "piece" || normalizedUnit === "pieces") {
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
