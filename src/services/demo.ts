/**
 * Synthetic example payloads for `nourish_demo`.
 *
 * The stated purpose of the demo tool is that agents see the contract *before*
 * any real call. That only holds if the examples match what the tools actually
 * return — an example advertising a field the server never emits makes an agent
 * write a parser for data that never arrives, and (worse) makes it produce a
 * plausible-but-wrong answer instead of failing loudly.
 *
 * These shapes are not hand-maintained guesses: `scripts/demo-contract-test.mjs`
 * runs the REAL `searchFoods` / `estimateMeal` / `buildDailySummary` pipelines
 * offline (fixture mode + a throwaway local store) and fails the build when the
 * key sets diverge in either direction — a key the demo invents, or a contract
 * key the demo omits.
 *
 * If you change a tool's output shape, that gate fails and points here.
 * Update this file — do not weaken the gate.
 */

const DEMO_DATE = "2026-05-05";
const DEMO_SEARCH_QUERY = "arroz";
const DEMO_MEAL_TEXT =
  "100 g de arroz branco cozido + 80 g de feijao carioca + 120 g de frango grelhado";

const TACO_LICENSE = {
  name: "TACO 4 — Tabela Brasileira de Composição de Alimentos (UNICAMP/NEPA)",
  attribution:
    "Composição nutricional reproduzida com atribuição da Tabela TACO 4ª edição (NEPA/UNICAMP). Reference: https://www.nepa.unicamp.br/tabela-brasileira-de-composicao-de-alimentos-4a-edicao/",
  share_alike: false,
  url: "https://www.nepa.unicamp.br/tabela-brasileira-de-composicao-de-alimentos-4a-edicao/",
};

/**
 * `nourish_search_food { query: "arroz", provider: "taco", limit: 1 }`.
 *
 * Note for agents: the top level is `{ provider, foods[] }` — NOT `{ ok, results[] }`.
 * Each food carries BOTH `nutrients_per_100g` and `nutrients_per_serving`; pick
 * the one that matches the portion you are reasoning about.
 */
function demoSearchFood() {
  return {
    provider: "taco",
    foods: [
      {
        id: "taco:taco:5",
        source: "taco",
        source_id: "taco:5",
        source_url:
          "https://www.nepa.unicamp.br/tabela-brasileira-de-composicao-de-alimentos-4a-edicao/",
        name: "Arroz, branco, cozido",
        locale: "pt-BR",
        serving: { quantity: 1, unit: "serving", grams: 80 },
        available_portions: [
          { label: "100g", quantity: 100, unit: "g", grams: 100 },
          { label: "1 escumadeira (~80g)", quantity: 1, unit: "serving", grams: 80 },
        ],
        nutrients_per_100g: {
          calories_kcal: 128,
          protein_g: 2.5,
          carbohydrates_g: 28.1,
          fat_g: 0.2,
          fiber_g: 1.6,
          sodium_mg: 1.2,
        },
        nutrients_per_serving: {
          calories_kcal: 102.4,
          protein_g: 2,
          carbohydrates_g: 22.48,
          fat_g: 0.16,
          fiber_g: 1.28,
          sodium_mg: 0.96,
        },
        license: TACO_LICENSE,
        data_quality: { completeness: "medium", confidence: 0.85, warnings: [] as string[] },
        carbon: {
          kg_co2e_per_kg: 4,
          source: "owid_poore_nemecek_2018:rice",
          license: "Our World in Data, derived from Poore & Nemecek 2018 — CC-BY 4.0",
          confidence: "low",
        },
      },
    ],
    warnings: [] as string[],
  };
}

/**
 * `nourish_estimate_meal { text: "...", meal_type: "lunch", locale: "pt-BR" }`.
 *
 * Note for agents: there is no `total_grams` and no `total_carbon_kg_co2e` here —
 * sum `items[].grams` yourself, and use `nourish_carbon_summary` for carbon.
 * `items[].name` is the canonical (English) food key the estimator matched, which
 * is how you can tell a pt-BR term was resolved. Anything the estimator could not
 * match lands in `unresolved` — ask one clarifying question instead of guessing.
 */
function demoEstimateMeal() {
  return {
    text: DEMO_MEAL_TEXT,
    locale: "pt-BR",
    meal_type: "lunch",
    items: [
      {
        name: "rice",
        quantity: 100,
        grams: 100,
        nutrients: { calories_kcal: 130, protein_g: 2.7, carbohydrates_g: 28, fat_g: 0.3 },
      },
      {
        name: "pinto beans",
        quantity: 80,
        grams: 80,
        nutrients: {
          calories_kcal: 60.8,
          protein_g: 3.84,
          carbohydrates_g: 10.88,
          fat_g: 0.4,
          fiber_g: 6.8,
        },
      },
      {
        name: "chicken",
        quantity: 120,
        grams: 120,
        nutrients: { calories_kcal: 198, protein_g: 37.2, carbohydrates_g: 0, fat_g: 4.32 },
      },
    ],
    total_nutrients: {
      calories_kcal: 388.8,
      protein_g: 43.74,
      carbohydrates_g: 38.88,
      fat_g: 5.02,
      fiber_g: 6.8,
    },
    confidence: 0.7,
    unresolved: [] as string[],
    warnings: ["Nutrition values are estimates from simple food defaults."],
    requested_text: DEMO_MEAL_TEXT,
    personal_memory: { expanded: false, matches: [] as unknown[] },
  };
}

/**
 * `nourish_daily_summary { date: "2026-05-05" }` at the default privacy mode.
 *
 * Note for agents: there is NO `goals_met` boolean map. Goal state lives in
 * `goal_progress`, keyed by the nutrient's full field name (`calories_kcal`,
 * not `calories`), and each entry is `{ actual, goal, percent }` — you decide
 * what "met" means. `by_meal` always carries all five meal buckets; an untouched
 * one is `{}`, not absent. Pass `compare_to: "yesterday" | "7d_avg"` to get an
 * extra `comparison` block (not shown here).
 */
function demoDailySummary() {
  return {
    date: DEMO_DATE,
    entry_count: 4,
    total_nutrients: {
      calories_kcal: 1748,
      protein_g: 92.7,
      carbohydrates_g: 194,
      fat_g: 60.4,
      fiber_g: 23.7,
      sodium_mg: 2094,
    },
    by_meal: {
      breakfast: {
        calories_kcal: 412,
        protein_g: 14.2,
        carbohydrates_g: 48.6,
        fat_g: 17.1,
        fiber_g: 2.4,
        sodium_mg: 486,
      },
      lunch: {
        calories_kcal: 631,
        protein_g: 42.8,
        carbohydrates_g: 71.4,
        fat_g: 15.3,
        fiber_g: 9.7,
        sodium_mg: 704,
      },
      dinner: {
        calories_kcal: 487,
        protein_g: 31.6,
        carbohydrates_g: 44.2,
        fat_g: 18.4,
        fiber_g: 8.1,
        sodium_mg: 892,
      },
      snack: {
        calories_kcal: 218,
        protein_g: 4.1,
        carbohydrates_g: 29.8,
        fat_g: 9.6,
        fiber_g: 3.5,
        sodium_mg: 12,
      },
      other: {},
    },
    hydration: {
      date: DEMO_DATE,
      total_ml: 1850,
      entries: [
        {
          id: "water_3f2b18c4-0d47-4a2e-9c51-6b0a7e5d1f88",
          timestamp: `${DEMO_DATE}T11:00:00.000Z`,
          date: DEMO_DATE,
          amount_ml: 600,
          source: "manual",
        },
        {
          id: "water_9a41c07e-52d8-4b13-8f6a-2c94d3e70b15",
          timestamp: `${DEMO_DATE}T17:30:00.000Z`,
          date: DEMO_DATE,
          amount_ml: 750,
          source: "manual",
        },
        {
          id: "water_c85d6a19-7e30-4f92-b4c8-1d05f8a2e963",
          timestamp: `${DEMO_DATE}T22:00:00.000Z`,
          date: DEMO_DATE,
          amount_ml: 500,
          source: "manual",
        },
      ],
      goal_ml: 3000,
      progress_percent: 61.67,
    },
    goal_progress: {
      calories_kcal: { actual: 1748, goal: 2200, percent: 79.45 },
      protein_g: { actual: 92.7, goal: 130, percent: 71.31 },
      fiber_g: { actual: 23.7, goal: 30, percent: 79 },
      hydration_ml: { actual: 1850, goal: 3000, percent: 61.67 },
    },
    confidence: 0.76,
    source_coverage: ["estimate", "taco"],
    privacy_mode: "structured",
  };
}

export function buildDemoPayload() {
  return {
    ok: true,
    is_demo: true,
    sample: {
      nourish_search_food: demoSearchFood(),
      nourish_estimate_meal: demoEstimateMeal(),
      nourish_daily_summary: demoDailySummary(),
    },
    inputs: {
      nourish_search_food: { query: DEMO_SEARCH_QUERY, provider: "taco", limit: 1 },
      nourish_estimate_meal: { text: DEMO_MEAL_TEXT, meal_type: "lunch", locale: "pt-BR" },
      nourish_daily_summary: { date: DEMO_DATE },
    },
    notes: [
      "All sample data is synthetic; tagged with is_demo=true. No real user intake is exposed.",
      "Shapes are gated: scripts/demo-contract-test.mjs runs the real search/estimate/summary pipelines and fails the build if these examples invent or omit a key.",
      "nourish_daily_summary reports goal state in `goal_progress` as { actual, goal, percent } keyed by full nutrient name (calories_kcal, not calories). There is no boolean goals_met map.",
      "nourish_search_food returns { provider, foods[] }; nutrient keys are optional per provider, so read defensively.",
      "nourish_estimate_meal returns no carbon total; call nourish_carbon_summary for footprint, and treat non-empty `unresolved` as a question to ask the user.",
      "In real use, results return live USDA + Open Food Facts + Brazilian TACO matches with carbon-footprint enrichment where a match exists.",
    ],
  };
}
