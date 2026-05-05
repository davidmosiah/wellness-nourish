import type { NutrientMap } from "../types.js";

export function roundNutrient(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function scaleNutrients(nutrients: NutrientMap, factor: number): NutrientMap {
  const scaled: NutrientMap = {};

  if (!Number.isFinite(factor)) {
    return scaled;
  }

  for (const [key, value] of Object.entries(nutrients) as Array<[keyof NutrientMap, number | undefined]>) {
    if (typeof value === "number" && Number.isFinite(value)) {
      scaled[key] = roundNutrient(value * factor);
    }
  }

  return scaled;
}

export function addNutrients(items: NutrientMap[]): NutrientMap {
  const totals: Partial<Record<keyof NutrientMap, number>> = {};

  for (const item of items) {
    for (const [key, value] of Object.entries(item) as Array<[keyof NutrientMap, number | undefined]>) {
      if (typeof value === "number" && Number.isFinite(value)) {
        totals[key] = (totals[key] ?? 0) + value;
      }
    }
  }

  const summed: NutrientMap = {};
  for (const [key, value] of Object.entries(totals) as Array<[keyof NutrientMap, number]>) {
    summed[key] = roundNutrient(value);
  }

  return summed;
}
