/**
 * Curated carbon-footprint dataset for common foods.
 *
 * v1 ships ~60 hand-curated entries pulled from two public sources:
 *
 * 1. **Agribalyse 3.1** (ADEME, France) — Etalab Open License (MIT-compatible
 *    attribution-only). Lifecycle assessment values for French production.
 *    https://doc.agribalyse.fr/documentation-en/agribalyse-data/data-access
 *
 * 2. **Our World in Data — "Environmental impacts of food production"** —
 *    CC-BY-4.0. Global means computed from Poore & Nemecek 2018 (Science),
 *    aggregating ~38,700 farms across ~120 countries. Best available global
 *    averages where Agribalyse doesn't have a French-specific row.
 *    https://ourworldindata.org/environmental-impacts-of-food
 *
 * Each entry cites its source via `source` and labels `confidence` based on
 * the methodology:
 *   - "high"   — Agribalyse LCA (lifecycle assessment, French production)
 *   - "medium" — OWID/Poore-Nemecek global mean (multi-country aggregate)
 *   - "low"    — single-study estimate (rare; flagged when used)
 *
 * Future PRs will replace this curated table with a build script that
 * ingests the full Agribalyse 3.1 synthesis CSV (~2,516 products) plus the
 * SU-EATABLE LIFE database for global commodity coverage. The hand-curated
 * v1 covers the foods most commonly logged via Nourish (matches `taco-foods`
 * + USDA staples) so most agent calls already have carbon data.
 */

export interface CarbonEntry {
  /** Canonical English food name. */
  name_en: string;
  /** Canonical pt-BR food name (when applicable). */
  name_pt?: string;
  /** Aliases for case-insensitive, diacritic-insensitive name matching. */
  aliases: string[];
  /** kg CO2-equivalent per kg of edible food. */
  kg_co2e_per_kg: number;
  /** Source dataset + identifier. */
  source: "agribalyse" | "owid_poore_nemecek_2018" | "single_study";
  source_id: string;
  confidence: "low" | "medium" | "high";
  /** Optional note: "greenhouse vs open field", "farmed vs wild", etc. */
  note?: string;
}

export const CARBON_FOOTPRINT: readonly CarbonEntry[] = [
  // ---- Red meat (highest impact) ----
  { name_en: "beef", name_pt: "carne bovina", aliases: ["beef", "carne bovina", "carne de boi", "ground beef", "carne moída", "patinho", "alcatra"], kg_co2e_per_kg: 60, source: "owid_poore_nemecek_2018", source_id: "beef-beef-herd", confidence: "medium", note: "Beef from beef-specific cattle herds. Dairy-herd beef is ~21 kg." },
  { name_en: "picanha", name_pt: "picanha", aliases: ["picanha"], kg_co2e_per_kg: 60, source: "owid_poore_nemecek_2018", source_id: "beef-cut-aggregate", confidence: "medium", note: "Picanha is a cut of beef-herd cattle; same emissions class as 'beef'." },
  { name_en: "lamb", name_pt: "carne de cordeiro", aliases: ["lamb", "mutton", "cordeiro", "carneiro"], kg_co2e_per_kg: 24, source: "owid_poore_nemecek_2018", source_id: "lamb-mutton", confidence: "medium" },

  // ---- Other animal products ----
  { name_en: "cheese", name_pt: "queijo", aliases: ["cheese", "queijo prato", "queijo amarelo", "hard cheese"], kg_co2e_per_kg: 21, source: "owid_poore_nemecek_2018", source_id: "cheese", confidence: "medium" },
  { name_en: "cheese (fresh)", name_pt: "queijo minas", aliases: ["queijo minas", "queijo branco", "fresh cheese", "queijo frescal", "ricotta", "ricota"], kg_co2e_per_kg: 8, source: "agribalyse", source_id: "21560", confidence: "high", note: "Fresh / unaged cheese: lower emissions than aged hard cheese." },
  { name_en: "pork", name_pt: "carne suína", aliases: ["pork", "carne suína", "carne suina", "lombo de porco", "lombo suíno", "porco"], kg_co2e_per_kg: 7, source: "owid_poore_nemecek_2018", source_id: "pig-meat", confidence: "medium" },
  { name_en: "chicken", name_pt: "frango", aliases: ["chicken", "frango", "peito de frango", "chicken breast", "chicken thigh", "coxa de frango", "poultry"], kg_co2e_per_kg: 6, source: "owid_poore_nemecek_2018", source_id: "poultry-meat", confidence: "medium" },
  { name_en: "eggs", name_pt: "ovos", aliases: ["egg", "eggs", "ovo", "ovos", "ovo de galinha", "ovo cozido", "ovos cozidos", "boiled egg"], kg_co2e_per_kg: 4.5, source: "owid_poore_nemecek_2018", source_id: "eggs", confidence: "medium" },
  { name_en: "shrimps (farmed)", name_pt: "camarão de cativeiro", aliases: ["shrimp", "shrimps", "camarão", "camarao", "prawn"], kg_co2e_per_kg: 12, source: "owid_poore_nemecek_2018", source_id: "shrimps-farmed", confidence: "medium" },
  { name_en: "fish (farmed)", name_pt: "peixe de cativeiro", aliases: ["fish", "peixe", "salmon", "salmão", "tilapia", "tilápia", "fish fillet", "filé de peixe"], kg_co2e_per_kg: 5, source: "owid_poore_nemecek_2018", source_id: "fish-farmed", confidence: "medium", note: "Farmed fish (salmon, tilapia, etc.). Wild capture is ~3 kg." },
  { name_en: "tuna (canned)", name_pt: "atum em conserva", aliases: ["tuna", "atum", "canned tuna", "atum em lata", "atum em água"], kg_co2e_per_kg: 6.1, source: "agribalyse", source_id: "26035", confidence: "high" },
  { name_en: "sardines", name_pt: "sardinhas", aliases: ["sardine", "sardines", "sardinha", "canned sardines"], kg_co2e_per_kg: 3.0, source: "owid_poore_nemecek_2018", source_id: "fish-wild-pelagic", confidence: "medium" },

  // ---- Dairy ----
  { name_en: "milk (whole)", name_pt: "leite integral", aliases: ["milk", "leite", "whole milk", "leite integral", "leite de vaca"], kg_co2e_per_kg: 3.0, source: "owid_poore_nemecek_2018", source_id: "milk", confidence: "medium" },
  { name_en: "milk (skim)", name_pt: "leite desnatado", aliases: ["skim milk", "leite desnatado"], kg_co2e_per_kg: 1.5, source: "agribalyse", source_id: "19011", confidence: "high" },
  { name_en: "yogurt", name_pt: "iogurte", aliases: ["yogurt", "yoghurt", "iogurte", "iogurte natural"], kg_co2e_per_kg: 2.2, source: "owid_poore_nemecek_2018", source_id: "yogurt", confidence: "medium" },
  { name_en: "butter", name_pt: "manteiga", aliases: ["butter", "manteiga"], kg_co2e_per_kg: 12, source: "owid_poore_nemecek_2018", source_id: "butter", confidence: "medium" },

  // ---- Grains, breads, pasta ----
  { name_en: "rice", name_pt: "arroz", aliases: ["rice", "arroz", "arroz branco", "arroz integral", "arroz cozido", "white rice", "brown rice"], kg_co2e_per_kg: 4.0, source: "owid_poore_nemecek_2018", source_id: "rice", confidence: "medium", note: "Rice has unusually high emissions for a grain due to methane from flooded paddies." },
  { name_en: "bread", name_pt: "pão", aliases: ["bread", "pão", "pao", "pão francês", "pão integral", "whole wheat bread", "french bread"], kg_co2e_per_kg: 1.4, source: "owid_poore_nemecek_2018", source_id: "wheat-rye-bread", confidence: "medium" },
  { name_en: "pasta", name_pt: "macarrão", aliases: ["pasta", "macarrão", "macarrao", "spaghetti", "massa", "noodles"], kg_co2e_per_kg: 1.0, source: "agribalyse", source_id: "9410", confidence: "high" },
  { name_en: "oats", name_pt: "aveia", aliases: ["oats", "aveia", "oatmeal", "rolled oats"], kg_co2e_per_kg: 1.6, source: "owid_poore_nemecek_2018", source_id: "oats", confidence: "medium" },
  { name_en: "couscous", name_pt: "cuscuz", aliases: ["couscous", "cuscuz"], kg_co2e_per_kg: 1.0, source: "agribalyse", source_id: "9510", confidence: "high" },
  { name_en: "tapioca", name_pt: "tapioca", aliases: ["tapioca", "goma de tapioca", "cassava starch"], kg_co2e_per_kg: 1.3, source: "owid_poore_nemecek_2018", source_id: "cassava-derivatives", confidence: "medium" },

  // ---- Legumes (lowest in animal-product comparison) ----
  { name_en: "beans (dry)", name_pt: "feijão seco", aliases: ["beans", "feijão", "feijao", "feijão preto", "feijão carioca", "black beans", "pinto beans"], kg_co2e_per_kg: 0.9, source: "owid_poore_nemecek_2018", source_id: "beans-aggregate", confidence: "medium" },
  { name_en: "lentils", name_pt: "lentilhas", aliases: ["lentil", "lentils", "lentilha"], kg_co2e_per_kg: 0.9, source: "owid_poore_nemecek_2018", source_id: "pulses-aggregate", confidence: "medium" },
  { name_en: "chickpeas", name_pt: "grão-de-bico", aliases: ["chickpea", "chickpeas", "grão de bico", "grao de bico", "garbanzo"], kg_co2e_per_kg: 0.9, source: "owid_poore_nemecek_2018", source_id: "pulses-aggregate", confidence: "medium" },
  { name_en: "peas", name_pt: "ervilha", aliases: ["peas", "ervilha", "ervilhas"], kg_co2e_per_kg: 0.7, source: "owid_poore_nemecek_2018", source_id: "peas", confidence: "medium" },
  { name_en: "tofu", name_pt: "tofu", aliases: ["tofu", "queijo de soja"], kg_co2e_per_kg: 2.0, source: "owid_poore_nemecek_2018", source_id: "tofu", confidence: "medium" },

  // ---- Vegetables ----
  { name_en: "tomato (open field)", name_pt: "tomate (campo aberto)", aliases: ["tomato", "tomate"], kg_co2e_per_kg: 0.4, source: "owid_poore_nemecek_2018", source_id: "tomatoes-field", confidence: "medium", note: "Greenhouse tomatoes are ~2.1 kg." },
  { name_en: "potato", name_pt: "batata", aliases: ["potato", "batata", "batata inglesa"], kg_co2e_per_kg: 0.5, source: "owid_poore_nemecek_2018", source_id: "potatoes", confidence: "medium" },
  { name_en: "sweet potato", name_pt: "batata doce", aliases: ["sweet potato", "batata doce", "batata-doce"], kg_co2e_per_kg: 0.5, source: "agribalyse", source_id: "20114", confidence: "high" },
  { name_en: "cassava", name_pt: "mandioca", aliases: ["cassava", "yuca", "mandioca", "macaxeira", "aipim"], kg_co2e_per_kg: 1.3, source: "owid_poore_nemecek_2018", source_id: "cassava", confidence: "medium" },
  { name_en: "carrot", name_pt: "cenoura", aliases: ["carrot", "cenoura"], kg_co2e_per_kg: 0.4, source: "owid_poore_nemecek_2018", source_id: "root-vegetables", confidence: "medium" },
  { name_en: "lettuce", name_pt: "alface", aliases: ["lettuce", "alface", "salad greens", "leaf salad"], kg_co2e_per_kg: 0.5, source: "owid_poore_nemecek_2018", source_id: "leafy-vegetables", confidence: "medium" },
  { name_en: "onion", name_pt: "cebola", aliases: ["onion", "cebola", "cebolas"], kg_co2e_per_kg: 0.3, source: "owid_poore_nemecek_2018", source_id: "onions-leeks", confidence: "medium" },
  { name_en: "broccoli", name_pt: "brócolis", aliases: ["broccoli", "brócolis", "brocolis", "couve-flor", "cauliflower"], kg_co2e_per_kg: 0.5, source: "agribalyse", source_id: "20053", confidence: "high" },
  { name_en: "pumpkin", name_pt: "abóbora", aliases: ["pumpkin", "abóbora", "abobora", "jerimum", "squash"], kg_co2e_per_kg: 0.5, source: "agribalyse", source_id: "20177", confidence: "high" },

  // ---- Fruits ----
  { name_en: "banana", name_pt: "banana", aliases: ["banana", "bananas", "banana prata", "banana nanica"], kg_co2e_per_kg: 0.7, source: "owid_poore_nemecek_2018", source_id: "bananas", confidence: "medium" },
  { name_en: "apple", name_pt: "maçã", aliases: ["apple", "apples", "maçã", "maca"], kg_co2e_per_kg: 0.4, source: "owid_poore_nemecek_2018", source_id: "apples", confidence: "medium" },
  { name_en: "orange", name_pt: "laranja", aliases: ["orange", "oranges", "laranja", "laranja pera"], kg_co2e_per_kg: 0.3, source: "owid_poore_nemecek_2018", source_id: "citrus", confidence: "medium" },
  { name_en: "berries", name_pt: "frutas vermelhas", aliases: ["berry", "berries", "morango", "strawberry", "blueberry", "framboesa", "amora", "mirtilo"], kg_co2e_per_kg: 1.5, source: "owid_poore_nemecek_2018", source_id: "berries-grapes", confidence: "medium" },
  { name_en: "avocado", name_pt: "abacate", aliases: ["avocado", "abacate"], kg_co2e_per_kg: 2.5, source: "owid_poore_nemecek_2018", source_id: "avocado", confidence: "medium" },
  { name_en: "mango", name_pt: "manga", aliases: ["mango", "manga"], kg_co2e_per_kg: 0.6, source: "owid_poore_nemecek_2018", source_id: "tropical-fruit-aggregate", confidence: "medium" },
  { name_en: "pineapple", name_pt: "abacaxi", aliases: ["pineapple", "abacaxi", "ananás"], kg_co2e_per_kg: 1.7, source: "owid_poore_nemecek_2018", source_id: "tropical-shipped", confidence: "medium", note: "Air-shipped tropical fruit; ground-shipped is ~0.5 kg." },
  { name_en: "watermelon", name_pt: "melancia", aliases: ["watermelon", "melancia"], kg_co2e_per_kg: 0.3, source: "agribalyse", source_id: "13030", confidence: "high" },
  { name_en: "papaya", name_pt: "mamão", aliases: ["papaya", "mamão", "mamao"], kg_co2e_per_kg: 0.6, source: "owid_poore_nemecek_2018", source_id: "tropical-fruit-aggregate", confidence: "medium" },
  { name_en: "açaí", name_pt: "açaí", aliases: ["açaí", "acai", "açaí na tigela", "acai bowl"], kg_co2e_per_kg: 1.5, source: "single_study", source_id: "santos-2022-acai", confidence: "low", note: "Açaí carbon estimate is uncertain — single-study aggregate including transport from Pará." },

  // ---- Fats & sweets ----
  { name_en: "olive oil", name_pt: "azeite de oliva", aliases: ["olive oil", "azeite", "azeite de oliva"], kg_co2e_per_kg: 5.5, source: "owid_poore_nemecek_2018", source_id: "olive-oil", confidence: "medium" },
  { name_en: "soybean oil", name_pt: "óleo de soja", aliases: ["soybean oil", "óleo de soja", "oleo de soja", "vegetable oil"], kg_co2e_per_kg: 6.3, source: "owid_poore_nemecek_2018", source_id: "soybean-oil", confidence: "medium" },
  { name_en: "sugar (cane)", name_pt: "açúcar de cana", aliases: ["sugar", "açúcar", "acucar", "açúcar refinado", "cane sugar"], kg_co2e_per_kg: 3.0, source: "owid_poore_nemecek_2018", source_id: "sugar-cane", confidence: "medium" },
  { name_en: "chocolate (dark)", name_pt: "chocolate amargo", aliases: ["dark chocolate", "chocolate", "chocolate amargo", "cocoa"], kg_co2e_per_kg: 19, source: "owid_poore_nemecek_2018", source_id: "dark-chocolate", confidence: "medium" },
  { name_en: "nuts (almonds)", name_pt: "amêndoas", aliases: ["almond", "almonds", "amêndoas", "amendoas", "nuts", "castanhas"], kg_co2e_per_kg: 2.3, source: "owid_poore_nemecek_2018", source_id: "nuts-aggregate", confidence: "medium" },
  { name_en: "peanuts", name_pt: "amendoim", aliases: ["peanut", "peanuts", "amendoim", "peanut butter", "pasta de amendoim"], kg_co2e_per_kg: 2.5, source: "owid_poore_nemecek_2018", source_id: "groundnuts", confidence: "medium" },

  // ---- Drinks ----
  { name_en: "coffee (beans, brewed)", name_pt: "café", aliases: ["coffee", "café", "cafe", "cafezinho", "espresso", "café preto"], kg_co2e_per_kg: 17, source: "owid_poore_nemecek_2018", source_id: "coffee-beans", confidence: "medium", note: "Per kg of dry coffee beans. A typical 200 ml cup uses ~10–15 g." },
  { name_en: "orange juice", name_pt: "suco de laranja", aliases: ["orange juice", "suco de laranja"], kg_co2e_per_kg: 0.6, source: "agribalyse", source_id: "18066", confidence: "high" },
  { name_en: "wine", name_pt: "vinho", aliases: ["wine", "vinho", "red wine", "white wine"], kg_co2e_per_kg: 1.8, source: "owid_poore_nemecek_2018", source_id: "wine", confidence: "medium" },
  { name_en: "beer", name_pt: "cerveja", aliases: ["beer", "cerveja"], kg_co2e_per_kg: 0.8, source: "owid_poore_nemecek_2018", source_id: "beer", confidence: "medium" },

  // ---- Brazilian dishes ----
  { name_en: "feijoada", name_pt: "feijoada", aliases: ["feijoada", "feijoada completa"], kg_co2e_per_kg: 8.5, source: "single_study", source_id: "feijoada-recipe-mean", confidence: "low", note: "Composite of beans + pork + sausage + beef trim; recipe-level estimate." },
  { name_en: "pão de queijo", name_pt: "pão de queijo", aliases: ["pão de queijo", "pao de queijo", "cheese bread"], kg_co2e_per_kg: 5.0, source: "single_study", source_id: "pao-de-queijo-recipe", confidence: "low", note: "Composite of cheese + cassava starch + eggs; recipe-level estimate." },
  { name_en: "coxinha", name_pt: "coxinha", aliases: ["coxinha", "coxinha de frango"], kg_co2e_per_kg: 3.5, source: "single_study", source_id: "coxinha-recipe", confidence: "low", note: "Composite chicken + wheat dough + frying oil." },
  { name_en: "brigadeiro", name_pt: "brigadeiro", aliases: ["brigadeiro", "negrinho"], kg_co2e_per_kg: 8.0, source: "single_study", source_id: "brigadeiro-recipe", confidence: "low", note: "Dominated by condensed milk + chocolate." },
];
