import { CARBON_FOOTPRINT, type CarbonEntry } from "../data/carbon-footprint.js";
import type { FoodItem, NutrientMap } from "../types.js";

/**
 * Look up carbon footprint for a food by name. Returns undefined when no
 * confident match is found (don't show false numbers — agents can say
 * "carbon data not available for this food" cleanly).
 *
 * Matching strategy:
 *   1. Exact (after normalize) on name_en, name_pt, or aliases — confidence kept
 *   2. Substring on aliases — confidence downgraded by one tier
 *   3. No match → undefined
 */
export function lookupCarbon(name: string): FoodItem["carbon"] | undefined {
  const normalizedQuery = normalize(name);
  if (normalizedQuery.length === 0) return undefined;

  // Pass 1: exact match
  for (const entry of CARBON_FOOTPRINT) {
    if (matches(normalizedQuery, entry, "exact")) {
      return toFoodItemCarbon(entry);
    }
  }

  // Pass 2: token-substring (every query token must be in some candidate)
  const queryTokens = normalizedQuery.split(/\s+/).filter((token) => token.length > 2);
  if (queryTokens.length === 0) return undefined;

  for (const entry of CARBON_FOOTPRINT) {
    if (matches(queryTokens, entry, "token")) {
      // Substring match — downgrade confidence one tier so callers know it's fuzzier.
      const downgraded = entry.confidence === "high"
        ? "medium"
        : entry.confidence === "medium"
          ? "low"
          : "low";
      return {
        ...toFoodItemCarbon(entry),
        confidence: downgraded,
      };
    }
  }

  return undefined;
}

/**
 * Enrich a FoodItem with carbon data in-place. Idempotent — won't overwrite
 * an existing `carbon` field. Returns the same reference for chaining.
 */
export function enrichWithCarbon(food: FoodItem): FoodItem {
  if (food.carbon !== undefined) return food;
  const carbon = lookupCarbon(food.name);
  if (carbon !== undefined) {
    food.carbon = carbon;
  }
  return food;
}

/**
 * Compute carbon for a meal: array of `{ name, grams }`. Returns the total
 * kg CO2-e plus a per-item breakdown including unmatched items so the agent
 * can flag what's missing.
 */
export interface CarbonMealItem {
  name: string;
  grams: number;
  /** Optional pre-resolved carbon (e.g. from FoodItem.carbon). Skips lookup if set. */
  carbon?: FoodItem["carbon"];
}

export interface CarbonMealResult {
  total_kg_co2e: number;
  items: Array<{
    name: string;
    grams: number;
    matched: boolean;
    kg_co2e?: number;
    carbon?: FoodItem["carbon"];
  }>;
  unmatched_count: number;
  /** Equivalents to make the number tangible. ~0.2 kg CO2e per km in average car. */
  equivalents: {
    km_driven_avg_car: number;
    smartphone_charges: number;
    /** kg CO2e from heating/cooking the food itself isn't included here — these are
     * lifestyle equivalents to make the meal's footprint relatable. */
  };
}

/** Average ICE car emits ~0.2 kg CO2e per km driven. Conservative midpoint. */
const KG_CO2E_PER_KM_AVG_CAR = 0.2;
/** A smartphone charge is ~8 g CO2e (~0.008 kg). Rough OWID figure. */
const KG_CO2E_PER_PHONE_CHARGE = 0.008;

export function computeMealCarbon(items: readonly CarbonMealItem[]): CarbonMealResult {
  let total = 0;
  let unmatched = 0;
  const breakdown: CarbonMealResult["items"] = [];

  for (const item of items) {
    const carbon = item.carbon ?? lookupCarbon(item.name);
    if (carbon === undefined) {
      unmatched += 1;
      breakdown.push({ name: item.name, grams: item.grams, matched: false });
      continue;
    }
    const itemKgCo2e = (carbon.kg_co2e_per_kg * item.grams) / 1000;
    total += itemKgCo2e;
    breakdown.push({
      name: item.name,
      grams: item.grams,
      matched: true,
      kg_co2e: round3(itemKgCo2e),
      carbon,
    });
  }

  return {
    total_kg_co2e: round3(total),
    items: breakdown,
    unmatched_count: unmatched,
    equivalents: {
      km_driven_avg_car: round3(total / KG_CO2E_PER_KM_AVG_CAR),
      smartphone_charges: Math.round(total / KG_CO2E_PER_PHONE_CHARGE),
    },
  };
}

/**
 * For a given list of foods (by name + grams), suggest swaps that would
 * reduce carbon. Returns the top-N swaps sorted by absolute kg CO2e saved.
 */
export interface CarbonSwapSuggestion {
  from_name: string;
  from_kg_co2e: number;
  to_name: string;
  to_kg_co2e_per_kg: number;
  saved_kg_co2e: number;
  reason: string;
}

export function suggestCarbonSwaps(
  items: readonly CarbonMealItem[],
  topN = 3,
): CarbonSwapSuggestion[] {
  const suggestions: CarbonSwapSuggestion[] = [];

  for (const item of items) {
    const fromCarbon = item.carbon ?? lookupCarbon(item.name);
    if (fromCarbon === undefined) continue;
    if (fromCarbon.kg_co2e_per_kg < 5) continue; // already low-carbon

    const itemKg = (fromCarbon.kg_co2e_per_kg * item.grams) / 1000;
    const swap = pickSwapFor(item.name, fromCarbon.kg_co2e_per_kg);
    if (swap === undefined) continue;

    const swapKg = (swap.kg_co2e_per_kg * item.grams) / 1000;
    suggestions.push({
      from_name: item.name,
      from_kg_co2e: round3(itemKg),
      to_name: swap.name_en,
      to_kg_co2e_per_kg: swap.kg_co2e_per_kg,
      saved_kg_co2e: round3(itemKg - swapKg),
      reason: `${swap.name_en} has ~${Math.round((1 - swap.kg_co2e_per_kg / fromCarbon.kg_co2e_per_kg) * 100)}% lower per-kg footprint than ${item.name}.`,
    });
  }

  return suggestions
    .sort((a, b) => b.saved_kg_co2e - a.saved_kg_co2e)
    .slice(0, topN);
}

/** Hand-curated swap rules. Only applied for high-carbon items. */
function pickSwapFor(name: string, currentKg: number): CarbonEntry | undefined {
  const normalized = normalize(name);
  if (/beef|cordeiro|lamb|carne bovina|carne moida|patinho|picanha/.test(normalized)) {
    // Beef → chicken (most realistic; fish saves more but harder for meat-eaters).
    return CARBON_FOOTPRINT.find((entry) => entry.name_en === "chicken");
  }
  if (/cheese|queijo prato|queijo amarelo/.test(normalized) && !/minas|fresh|ricota/.test(normalized)) {
    return CARBON_FOOTPRINT.find((entry) => entry.name_en === "cheese (fresh)");
  }
  if (/shrimp|camarao/.test(normalized)) {
    return CARBON_FOOTPRINT.find((entry) => entry.name_en === "fish (farmed)");
  }
  // Generic: look for something in the same broad category but with <50% of the carbon.
  const reduced = CARBON_FOOTPRINT.find((entry) => entry.kg_co2e_per_kg < currentKg * 0.5);
  return reduced;
}

function toFoodItemCarbon(entry: CarbonEntry): NonNullable<FoodItem["carbon"]> {
  const license = sourceLicense(entry.source);
  return {
    kg_co2e_per_kg: entry.kg_co2e_per_kg,
    source: `${entry.source}:${entry.source_id}`,
    license,
    confidence: entry.confidence,
  };
}

function sourceLicense(source: CarbonEntry["source"]): string {
  if (source === "agribalyse") {
    return "Agribalyse 3.1 (ADEME) — Etalab Open License (attribution required)";
  }
  if (source === "owid_poore_nemecek_2018") {
    return "Our World in Data, derived from Poore & Nemecek 2018 — CC-BY 4.0";
  }
  return "Single-study estimate (low confidence) — see CHANGELOG / data/carbon-footprint.ts for citation";
}

function matches(
  query: string | string[],
  entry: CarbonEntry,
  mode: "exact" | "token",
): boolean {
  const candidates = [entry.name_en, entry.name_pt, ...entry.aliases]
    .filter((value): value is string => typeof value === "string")
    .map(normalize);

  if (mode === "exact" && typeof query === "string") {
    return candidates.includes(query);
  }
  if (mode === "token" && Array.isArray(query)) {
    // Token-level subset match: a candidate matches the query when EITHER
    //   (a) every token in the candidate appears in the query, OR
    //   (b) every token in the query appears in the candidate.
    // (a) covers the common case where the dataset has a short alias
    // ("frango") and the query has extra modifiers ("peito de frango grelhado").
    // (b) covers the inverse — short query against a longer alias.
    return candidates.some((candidate) => {
      const candidateTokens = candidate.split(/\s+/).filter((token) => token.length > 2);
      if (candidateTokens.length === 0) return false;
      const allCandidateInQuery = candidateTokens.every((token) => query.includes(token));
      if (allCandidateInQuery) return true;
      const allQueryInCandidate = query.every((token) => candidate.includes(token));
      return allQueryInCandidate;
    });
  }
  return false;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Total foods in the dataset — exposed for capabilities/manifest reporting. */
export function carbonDatasetSize(): number {
  return CARBON_FOOTPRINT.length;
}
