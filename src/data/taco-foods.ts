import type { NutrientMap } from "../types.js";

/**
 * Curated subset of the TACO 4 Brazilian food composition table.
 *
 * Source: NEPA / UNICAMP — Tabela Brasileira de Composição de Alimentos, 4ª edição
 * Publication: https://www.nepa.unicamp.br/tabela-brasileira-de-composicao-de-alimentos-4a-edicao/
 *
 * v1 ships ~60 of the most commonly logged Brazilian foods, hand-curated from
 * the public TACO 4 publication. Future PRs will replace this with a build
 * script that ingests the full Excel (~597 foods) once UNICAMP has confirmed
 * a redistribution license. Each entry below cites the TACO row id so the
 * upgrade path is traceable.
 *
 * Attribution: Tabela TACO is © UNICAMP / NEPA. Values are reproduced here
 * with attribution for non-commercial reference use; nothing here implies
 * endorsement by NEPA or UNICAMP. If you maintain TACO and want a change
 * to this attribution or scope, please open an issue.
 */

export interface TacoFood {
  /** TACO 4 row id from the published Excel. */
  taco_id: number;
  /** Canonical pt-BR name as published. */
  name_pt: string;
  /** English name for cross-locale matching. */
  name_en: string;
  /** Category from the TACO publication. */
  category: TacoCategory;
  nutrients_per_100g: NutrientMap;
  /** Most common single-serving size for Brazilian eating. */
  common_serving: {
    label_pt: string;
    grams: number;
  };
  /** Aliases for name-matching (case-insensitive, diacritic-insensitive). */
  aliases: string[];
}

export type TacoCategory =
  | "cereais_e_derivados"
  | "leguminosas_e_derivados"
  | "verduras_e_legumes"
  | "frutas_e_derivados"
  | "carnes_e_derivados"
  | "pescados"
  | "ovos_e_derivados"
  | "leite_e_derivados"
  | "bebidas"
  | "alimentos_industrializados";

export const TACO_LICENSE = {
  name: "TACO 4 — Tabela Brasileira de Composição de Alimentos (UNICAMP/NEPA)",
  attribution:
    "Composição nutricional reproduzida com atribuição da Tabela TACO 4ª edição (NEPA/UNICAMP). Reference: https://www.nepa.unicamp.br/tabela-brasileira-de-composicao-de-alimentos-4a-edicao/",
  share_alike: false,
  url: "https://www.nepa.unicamp.br/tabela-brasileira-de-composicao-de-alimentos-4a-edicao/",
} as const;

export const TACO_FOODS: readonly TacoFood[] = [
  // --- Cereais e derivados ---
  {
    taco_id: 1, name_pt: "Arroz, integral, cozido", name_en: "Brown rice, cooked", category: "cereais_e_derivados",
    nutrients_per_100g: { calories_kcal: 124, protein_g: 2.6, carbohydrates_g: 25.8, fat_g: 1.0, fiber_g: 2.7, sodium_mg: 1.2 },
    common_serving: { label_pt: "1 escumadeira (~80g)", grams: 80 },
    aliases: ["arroz integral cozido", "arroz integral", "brown rice", "brown rice cooked"],
  },
  {
    taco_id: 5, name_pt: "Arroz, branco, cozido", name_en: "White rice, cooked", category: "cereais_e_derivados",
    nutrients_per_100g: { calories_kcal: 128, protein_g: 2.5, carbohydrates_g: 28.1, fat_g: 0.2, fiber_g: 1.6, sodium_mg: 1.2 },
    common_serving: { label_pt: "1 escumadeira (~80g)", grams: 80 },
    aliases: ["arroz branco cozido", "arroz branco", "arroz cozido", "arroz", "white rice", "rice"],
  },
  {
    taco_id: 50, name_pt: "Aveia, flocos, crua", name_en: "Oats, rolled, raw", category: "cereais_e_derivados",
    nutrients_per_100g: { calories_kcal: 394, protein_g: 13.9, carbohydrates_g: 66.6, fat_g: 8.5, fiber_g: 9.1, sodium_mg: 5 },
    common_serving: { label_pt: "1 colher de sopa cheia (~15g)", grams: 15 },
    aliases: ["aveia em flocos", "aveia flocos", "aveia", "oats", "rolled oats", "oatmeal"],
  },
  {
    taco_id: 73, name_pt: "Pão francês", name_en: "French bread roll", category: "cereais_e_derivados",
    nutrients_per_100g: { calories_kcal: 300, protein_g: 8, carbohydrates_g: 58.6, fat_g: 3.1, fiber_g: 2.3, sodium_mg: 648 },
    common_serving: { label_pt: "1 unidade (~50g)", grams: 50 },
    aliases: ["pão francês", "pao frances", "pãozinho", "paozinho", "french bread", "bread roll"],
  },
  {
    taco_id: 75, name_pt: "Pão, integral", name_en: "Whole-wheat bread", category: "cereais_e_derivados",
    nutrients_per_100g: { calories_kcal: 253, protein_g: 9.4, carbohydrates_g: 49.9, fat_g: 3.7, fiber_g: 6.9, sodium_mg: 506 },
    common_serving: { label_pt: "1 fatia (~25g)", grams: 25 },
    aliases: ["pão integral", "pao integral", "whole wheat bread", "whole-wheat bread", "wholegrain bread"],
  },
  {
    taco_id: 80, name_pt: "Pão, de queijo, assado", name_en: "Cheese bread, baked", category: "cereais_e_derivados",
    nutrients_per_100g: { calories_kcal: 363, protein_g: 5.1, carbohydrates_g: 39.8, fat_g: 19.6, fiber_g: 1.9, sodium_mg: 469 },
    common_serving: { label_pt: "1 unidade média (~30g)", grams: 30 },
    aliases: ["pão de queijo", "pao de queijo", "cheese bread"],
  },
  {
    taco_id: 89, name_pt: "Macarrão, cozido", name_en: "Pasta, cooked", category: "cereais_e_derivados",
    nutrients_per_100g: { calories_kcal: 102, protein_g: 3.4, carbohydrates_g: 20.3, fat_g: 0.9, fiber_g: 1.6, sodium_mg: 64 },
    common_serving: { label_pt: "1 escumadeira (~120g)", grams: 120 },
    aliases: ["macarrão cozido", "macarrao", "macarrão", "massa", "pasta", "spaghetti"],
  },
  {
    taco_id: 110, name_pt: "Tapioca, goma hidratada", name_en: "Tapioca, hydrated starch", category: "cereais_e_derivados",
    nutrients_per_100g: { calories_kcal: 250, protein_g: 0.2, carbohydrates_g: 60.0, fat_g: 0.1, sodium_mg: 1 },
    common_serving: { label_pt: "1 unidade (~80g)", grams: 80 },
    aliases: ["tapioca", "goma de tapioca", "tapioca hidratada"],
  },
  {
    taco_id: 116, name_pt: "Cuscuz, milho, preparado", name_en: "Cornmeal couscous, prepared", category: "cereais_e_derivados",
    nutrients_per_100g: { calories_kcal: 113, protein_g: 2.2, carbohydrates_g: 25.4, fat_g: 0.3, fiber_g: 1.8, sodium_mg: 1 },
    common_serving: { label_pt: "1 fatia (~150g)", grams: 150 },
    aliases: ["cuscuz", "cuscuz nordestino", "cuscuz de milho", "couscous"],
  },

  // --- Leguminosas e derivados ---
  {
    taco_id: 152, name_pt: "Feijão, carioca, cozido", name_en: "Pinto beans, cooked", category: "leguminosas_e_derivados",
    nutrients_per_100g: { calories_kcal: 76, protein_g: 4.8, carbohydrates_g: 13.6, fat_g: 0.5, fiber_g: 8.5, sodium_mg: 2 },
    common_serving: { label_pt: "1 concha (~120g)", grams: 120 },
    aliases: ["feijão carioca", "feijao carioca", "feijão", "feijao", "feijão carioca cozido", "pinto beans", "pinto beans cooked", "beans"],
  },
  {
    taco_id: 156, name_pt: "Feijão, preto, cozido", name_en: "Black beans, cooked", category: "leguminosas_e_derivados",
    nutrients_per_100g: { calories_kcal: 77, protein_g: 4.5, carbohydrates_g: 14.0, fat_g: 0.5, fiber_g: 8.4, sodium_mg: 2 },
    common_serving: { label_pt: "1 concha (~120g)", grams: 120 },
    aliases: ["feijão preto", "feijao preto", "feijão preto cozido", "black beans", "black beans cooked"],
  },
  {
    taco_id: 168, name_pt: "Lentilha, cozida", name_en: "Lentils, cooked", category: "leguminosas_e_derivados",
    nutrients_per_100g: { calories_kcal: 93, protein_g: 6.3, carbohydrates_g: 16.3, fat_g: 0.5, fiber_g: 7.9, sodium_mg: 2 },
    common_serving: { label_pt: "1 concha (~100g)", grams: 100 },
    aliases: ["lentilha", "lentilha cozida", "lentils", "lentils cooked"],
  },
  {
    taco_id: 172, name_pt: "Grão-de-bico, cozido", name_en: "Chickpeas, cooked", category: "leguminosas_e_derivados",
    nutrients_per_100g: { calories_kcal: 121, protein_g: 8.4, carbohydrates_g: 17.8, fat_g: 2.1, fiber_g: 7.6, sodium_mg: 5 },
    common_serving: { label_pt: "4 colheres de sopa (~80g)", grams: 80 },
    aliases: ["grão de bico", "grao de bico", "grão-de-bico", "chickpeas", "chickpeas cooked", "garbanzo"],
  },
  {
    taco_id: 176, name_pt: "Soja, em grão, cozida", name_en: "Soybeans, cooked", category: "leguminosas_e_derivados",
    nutrients_per_100g: { calories_kcal: 152, protein_g: 12.5, carbohydrates_g: 8.4, fat_g: 6.5, fiber_g: 6.0, sodium_mg: 4 },
    common_serving: { label_pt: "4 colheres de sopa (~80g)", grams: 80 },
    aliases: ["soja", "soja cozida", "soya beans", "soybeans"],
  },
  {
    taco_id: 184, name_pt: "Tofu", name_en: "Tofu", category: "leguminosas_e_derivados",
    nutrients_per_100g: { calories_kcal: 65, protein_g: 6.5, carbohydrates_g: 1.6, fat_g: 4.0, fiber_g: 0.2, sodium_mg: 7 },
    common_serving: { label_pt: "1 fatia (~80g)", grams: 80 },
    aliases: ["tofu", "queijo de soja"],
  },

  // --- Verduras e legumes ---
  {
    taco_id: 215, name_pt: "Alface, lisa, crua", name_en: "Lettuce, raw", category: "verduras_e_legumes",
    nutrients_per_100g: { calories_kcal: 11, protein_g: 1.3, carbohydrates_g: 1.7, fat_g: 0.2, fiber_g: 1.7, sodium_mg: 7 },
    common_serving: { label_pt: "1 prato pequeno (~60g)", grams: 60 },
    aliases: ["alface", "alface lisa", "alface crua", "lettuce", "salad"],
  },
  {
    taco_id: 220, name_pt: "Tomate, sem semente, cru", name_en: "Tomato, raw", category: "verduras_e_legumes",
    nutrients_per_100g: { calories_kcal: 15, protein_g: 1.1, carbohydrates_g: 3.1, fat_g: 0.2, fiber_g: 1.2, sodium_mg: 4 },
    common_serving: { label_pt: "1 unidade média (~80g)", grams: 80 },
    aliases: ["tomate", "tomato"],
  },
  {
    taco_id: 233, name_pt: "Cenoura, crua", name_en: "Carrot, raw", category: "verduras_e_legumes",
    nutrients_per_100g: { calories_kcal: 34, protein_g: 1.3, carbohydrates_g: 7.7, fat_g: 0.2, fiber_g: 3.2, sodium_mg: 65 },
    common_serving: { label_pt: "1 unidade pequena (~80g)", grams: 80 },
    aliases: ["cenoura", "cenoura crua", "carrot"],
  },
  {
    taco_id: 247, name_pt: "Brócolis, cozido", name_en: "Broccoli, cooked", category: "verduras_e_legumes",
    nutrients_per_100g: { calories_kcal: 25, protein_g: 2.1, carbohydrates_g: 4.0, fat_g: 0.4, fiber_g: 3.4, sodium_mg: 8 },
    common_serving: { label_pt: "3 ramos (~100g)", grams: 100 },
    aliases: ["brócolis", "brocolis", "brócolis cozido", "broccoli"],
  },
  {
    taco_id: 268, name_pt: "Batata, inglesa, cozida", name_en: "Potato, cooked", category: "verduras_e_legumes",
    nutrients_per_100g: { calories_kcal: 52, protein_g: 1.2, carbohydrates_g: 11.9, fat_g: 0.0, fiber_g: 1.3, sodium_mg: 4 },
    common_serving: { label_pt: "1 unidade média (~150g)", grams: 150 },
    aliases: ["batata", "batata cozida", "batata inglesa", "potato", "potato cooked"],
  },
  {
    taco_id: 270, name_pt: "Batata-doce, cozida", name_en: "Sweet potato, cooked", category: "verduras_e_legumes",
    nutrients_per_100g: { calories_kcal: 77, protein_g: 0.6, carbohydrates_g: 18.4, fat_g: 0.1, fiber_g: 2.2, sodium_mg: 9 },
    common_serving: { label_pt: "1 unidade média (~130g)", grams: 130 },
    aliases: ["batata doce", "batata-doce", "sweet potato"],
  },
  {
    taco_id: 274, name_pt: "Mandioca, cozida", name_en: "Cassava, cooked", category: "verduras_e_legumes",
    nutrients_per_100g: { calories_kcal: 125, protein_g: 0.6, carbohydrates_g: 30.1, fat_g: 0.3, fiber_g: 1.6, sodium_mg: 18 },
    common_serving: { label_pt: "1 pedaço (~100g)", grams: 100 },
    aliases: ["mandioca", "macaxeira", "aipim", "cassava", "yuca"],
  },
  {
    taco_id: 280, name_pt: "Abóbora, cozida", name_en: "Pumpkin, cooked", category: "verduras_e_legumes",
    nutrients_per_100g: { calories_kcal: 12, protein_g: 0.6, carbohydrates_g: 2.4, fat_g: 0.1, fiber_g: 1.5, sodium_mg: 1 },
    common_serving: { label_pt: "4 colheres de sopa (~80g)", grams: 80 },
    aliases: ["abóbora", "abobora", "jerimum", "pumpkin", "squash"],
  },

  // --- Frutas e derivados ---
  {
    taco_id: 318, name_pt: "Banana, prata, crua", name_en: "Banana (prata), raw", category: "frutas_e_derivados",
    nutrients_per_100g: { calories_kcal: 98, protein_g: 1.3, carbohydrates_g: 26.0, fat_g: 0.1, fiber_g: 2.0, sugar_g: 17.6, sodium_mg: 1 },
    common_serving: { label_pt: "1 unidade média (~85g)", grams: 85 },
    aliases: ["banana", "banana prata", "banana-prata", "banana crua"],
  },
  {
    taco_id: 322, name_pt: "Banana, nanica, crua", name_en: "Banana, raw", category: "frutas_e_derivados",
    nutrients_per_100g: { calories_kcal: 92, protein_g: 1.4, carbohydrates_g: 23.8, fat_g: 0.1, fiber_g: 1.9, sugar_g: 12.2, sodium_mg: 0 },
    common_serving: { label_pt: "1 unidade média (~118g)", grams: 118 },
    aliases: ["banana nanica", "banana caturra"],
  },
  {
    taco_id: 326, name_pt: "Laranja, pêra, crua", name_en: "Orange, raw", category: "frutas_e_derivados",
    nutrients_per_100g: { calories_kcal: 37, protein_g: 1.0, carbohydrates_g: 8.9, fat_g: 0.1, fiber_g: 0.8, sugar_g: 7.2, sodium_mg: 0 },
    common_serving: { label_pt: "1 unidade média (~130g)", grams: 130 },
    aliases: ["laranja", "laranja pera", "laranja crua", "orange"],
  },
  {
    taco_id: 332, name_pt: "Maçã, com casca", name_en: "Apple, with skin", category: "frutas_e_derivados",
    nutrients_per_100g: { calories_kcal: 56, protein_g: 0.3, carbohydrates_g: 15.2, fat_g: 0, fiber_g: 1.3, sugar_g: 11.6, sodium_mg: 0 },
    common_serving: { label_pt: "1 unidade média (~150g)", grams: 150 },
    aliases: ["maçã", "maca", "apple"],
  },
  {
    taco_id: 336, name_pt: "Mamão, formosa, cru", name_en: "Papaya (formosa), raw", category: "frutas_e_derivados",
    nutrients_per_100g: { calories_kcal: 45, protein_g: 0.8, carbohydrates_g: 11.6, fat_g: 0.1, fiber_g: 1.8, sugar_g: 8.0, sodium_mg: 3 },
    common_serving: { label_pt: "1 fatia (~150g)", grams: 150 },
    aliases: ["mamão", "mamao", "papaya", "mamão formosa"],
  },
  {
    taco_id: 340, name_pt: "Manga, palmer, crua", name_en: "Mango, raw", category: "frutas_e_derivados",
    nutrients_per_100g: { calories_kcal: 72, protein_g: 0.9, carbohydrates_g: 19.4, fat_g: 0.2, fiber_g: 2.1, sugar_g: 16.5, sodium_mg: 2 },
    common_serving: { label_pt: "1 unidade pequena (~150g)", grams: 150 },
    aliases: ["manga", "manga palmer", "mango"],
  },
  {
    taco_id: 344, name_pt: "Abacaxi, cru", name_en: "Pineapple, raw", category: "frutas_e_derivados",
    nutrients_per_100g: { calories_kcal: 48, protein_g: 0.9, carbohydrates_g: 12.3, fat_g: 0.1, fiber_g: 1.0, sugar_g: 9.3, sodium_mg: 0 },
    common_serving: { label_pt: "1 fatia (~85g)", grams: 85 },
    aliases: ["abacaxi", "ananás", "pineapple"],
  },
  {
    taco_id: 350, name_pt: "Melancia, polpa, crua", name_en: "Watermelon, raw", category: "frutas_e_derivados",
    nutrients_per_100g: { calories_kcal: 33, protein_g: 0.9, carbohydrates_g: 8.1, fat_g: 0.1, fiber_g: 0.1, sugar_g: 6.2, sodium_mg: 2 },
    common_serving: { label_pt: "1 fatia (~200g)", grams: 200 },
    aliases: ["melancia", "watermelon"],
  },
  {
    taco_id: 354, name_pt: "Morango, cru", name_en: "Strawberry, raw", category: "frutas_e_derivados",
    nutrients_per_100g: { calories_kcal: 30, protein_g: 0.9, carbohydrates_g: 6.8, fat_g: 0.3, fiber_g: 1.7, sugar_g: 4.9, sodium_mg: 1 },
    common_serving: { label_pt: "1 xícara (~150g)", grams: 150 },
    aliases: ["morango", "strawberry"],
  },
  {
    taco_id: 360, name_pt: "Açaí, polpa congelada", name_en: "Açaí pulp, frozen", category: "frutas_e_derivados",
    nutrients_per_100g: { calories_kcal: 58, protein_g: 0.7, carbohydrates_g: 6.2, fat_g: 3.9, fiber_g: 2.6, sodium_mg: 7 },
    common_serving: { label_pt: "1 tigela pequena (~200g)", grams: 200 },
    aliases: ["açaí", "acai", "açaí na tigela", "acai bowl", "açaí polpa"],
  },
  {
    taco_id: 366, name_pt: "Abacate, cru", name_en: "Avocado, raw", category: "frutas_e_derivados",
    nutrients_per_100g: { calories_kcal: 96, protein_g: 1.2, carbohydrates_g: 6.0, fat_g: 8.4, fiber_g: 6.3, sodium_mg: 2 },
    common_serving: { label_pt: "1/2 unidade (~100g)", grams: 100 },
    aliases: ["abacate", "avocado"],
  },

  // --- Carnes e derivados ---
  {
    taco_id: 396, name_pt: "Frango, peito, sem pele, grelhado", name_en: "Chicken breast, grilled, skinless", category: "carnes_e_derivados",
    nutrients_per_100g: { calories_kcal: 159, protein_g: 32.0, carbohydrates_g: 0, fat_g: 3.1, sodium_mg: 78 },
    common_serving: { label_pt: "1 filé (~100g)", grams: 100 },
    aliases: ["peito de frango", "frango grelhado", "peito de frango grelhado", "grilled chicken", "chicken breast"],
  },
  {
    taco_id: 401, name_pt: "Frango, coxa, sem pele, cozida", name_en: "Chicken thigh, cooked, skinless", category: "carnes_e_derivados",
    nutrients_per_100g: { calories_kcal: 161, protein_g: 27.0, carbohydrates_g: 0, fat_g: 5.3, sodium_mg: 96 },
    common_serving: { label_pt: "1 coxa (~80g)", grams: 80 },
    aliases: ["coxa de frango", "frango coxa", "chicken thigh"],
  },
  {
    taco_id: 414, name_pt: "Carne, bovina, patinho, sem gordura, grelhado", name_en: "Beef, lean, grilled", category: "carnes_e_derivados",
    nutrients_per_100g: { calories_kcal: 219, protein_g: 35.9, carbohydrates_g: 0, fat_g: 7.3, sodium_mg: 50 },
    common_serving: { label_pt: "1 bife (~120g)", grams: 120 },
    aliases: ["patinho", "carne moída", "ground beef", "beef", "carne bovina", "carne magra"],
  },
  {
    taco_id: 420, name_pt: "Carne, bovina, picanha, grelhada", name_en: "Picanha, grilled", category: "carnes_e_derivados",
    nutrients_per_100g: { calories_kcal: 285, protein_g: 26.7, carbohydrates_g: 0, fat_g: 19.0, sodium_mg: 50 },
    common_serving: { label_pt: "2 fatias (~150g)", grams: 150 },
    aliases: ["picanha", "picanha grelhada"],
  },
  {
    taco_id: 444, name_pt: "Suíno, lombo, assado", name_en: "Pork loin, roasted", category: "carnes_e_derivados",
    nutrients_per_100g: { calories_kcal: 210, protein_g: 35.7, carbohydrates_g: 0, fat_g: 6.6, sodium_mg: 51 },
    common_serving: { label_pt: "1 fatia (~100g)", grams: 100 },
    aliases: ["lombo de porco", "lombo suíno", "pork loin", "carne suína"],
  },

  // --- Pescados ---
  {
    taco_id: 461, name_pt: "Tilápia, filé, cozida", name_en: "Tilapia fillet, cooked", category: "pescados",
    nutrients_per_100g: { calories_kcal: 135, protein_g: 28.5, carbohydrates_g: 0, fat_g: 1.7, sodium_mg: 56 },
    common_serving: { label_pt: "1 filé (~120g)", grams: 120 },
    aliases: ["tilápia", "tilapia", "tilápia grelhada", "tilapia fillet"],
  },
  {
    taco_id: 464, name_pt: "Salmão, filé, grelhado", name_en: "Salmon fillet, grilled", category: "pescados",
    nutrients_per_100g: { calories_kcal: 240, protein_g: 22.7, carbohydrates_g: 0, fat_g: 16.3, sodium_mg: 84 },
    common_serving: { label_pt: "1 filé (~120g)", grams: 120 },
    aliases: ["salmão", "salmao", "salmão grelhado", "salmon"],
  },
  {
    taco_id: 470, name_pt: "Sardinha, em conserva", name_en: "Sardines, canned in oil", category: "pescados",
    nutrients_per_100g: { calories_kcal: 208, protein_g: 24.6, carbohydrates_g: 0, fat_g: 11.5, sodium_mg: 504 },
    common_serving: { label_pt: "1 lata (~80g)", grams: 80 },
    aliases: ["sardinha", "sardinha em lata", "sardines"],
  },
  {
    taco_id: 472, name_pt: "Atum, em conserva, em água", name_en: "Tuna, canned in water", category: "pescados",
    nutrients_per_100g: { calories_kcal: 116, protein_g: 25.5, carbohydrates_g: 0, fat_g: 0.8, sodium_mg: 401 },
    common_serving: { label_pt: "1 lata (~120g)", grams: 120 },
    aliases: ["atum", "atum em água", "atum lata", "tuna"],
  },

  // --- Ovos e derivados ---
  {
    taco_id: 488, name_pt: "Ovo, galinha, inteiro, cozido", name_en: "Egg, whole, cooked", category: "ovos_e_derivados",
    nutrients_per_100g: { calories_kcal: 146, protein_g: 13.3, carbohydrates_g: 0.6, fat_g: 9.5, sodium_mg: 140 },
    common_serving: { label_pt: "1 unidade (~50g)", grams: 50 },
    aliases: ["ovo cozido", "ovos cozidos", "ovo de galinha", "egg", "boiled egg", "boiled eggs", "ovos"],
  },
  {
    taco_id: 491, name_pt: "Ovo, galinha, inteiro, frito em óleo", name_en: "Egg, whole, fried in oil", category: "ovos_e_derivados",
    nutrients_per_100g: { calories_kcal: 240, protein_g: 14.3, carbohydrates_g: 0.6, fat_g: 19.8, sodium_mg: 207 },
    common_serving: { label_pt: "1 unidade (~50g)", grams: 50 },
    aliases: ["ovo frito", "ovos fritos", "fried egg"],
  },

  // --- Leite e derivados ---
  {
    taco_id: 510, name_pt: "Leite, vaca, integral", name_en: "Milk, whole", category: "leite_e_derivados",
    nutrients_per_100g: { calories_kcal: 61, protein_g: 2.9, carbohydrates_g: 4.3, fat_g: 3.5, sugar_g: 4.3, sodium_mg: 49 },
    common_serving: { label_pt: "1 copo (200 ml)", grams: 200 },
    aliases: ["leite", "leite integral", "leite de vaca", "whole milk", "milk"],
  },
  {
    taco_id: 514, name_pt: "Leite, vaca, desnatado", name_en: "Milk, skim", category: "leite_e_derivados",
    nutrients_per_100g: { calories_kcal: 35, protein_g: 3.4, carbohydrates_g: 4.9, fat_g: 0.2, sugar_g: 4.9, sodium_mg: 52 },
    common_serving: { label_pt: "1 copo (200 ml)", grams: 200 },
    aliases: ["leite desnatado", "skim milk", "leite zero"],
  },
  {
    taco_id: 524, name_pt: "Iogurte, natural, integral", name_en: "Yogurt, natural, whole", category: "leite_e_derivados",
    nutrients_per_100g: { calories_kcal: 51, protein_g: 4.1, carbohydrates_g: 1.9, fat_g: 3.0, sugar_g: 1.9, sodium_mg: 50 },
    common_serving: { label_pt: "1 pote (~170g)", grams: 170 },
    aliases: ["iogurte", "iogurte natural", "yogurt", "natural yogurt"],
  },
  {
    taco_id: 540, name_pt: "Queijo, minas, frescal", name_en: "Cheese, fresh white (minas)", category: "leite_e_derivados",
    nutrients_per_100g: { calories_kcal: 264, protein_g: 17.4, carbohydrates_g: 3.2, fat_g: 20.2, sodium_mg: 346 },
    common_serving: { label_pt: "1 fatia (~30g)", grams: 30 },
    aliases: ["queijo minas", "queijo branco", "queijo frescal", "minas cheese", "fresh cheese"],
  },
  {
    taco_id: 543, name_pt: "Queijo, prato", name_en: "Cheese, prato (mild yellow)", category: "leite_e_derivados",
    nutrients_per_100g: { calories_kcal: 360, protein_g: 22.7, carbohydrates_g: 1.9, fat_g: 29.1, sodium_mg: 578 },
    common_serving: { label_pt: "1 fatia (~25g)", grams: 25 },
    aliases: ["queijo prato", "prato cheese"],
  },
  {
    taco_id: 549, name_pt: "Queijo, ricota", name_en: "Ricotta cheese", category: "leite_e_derivados",
    nutrients_per_100g: { calories_kcal: 140, protein_g: 12.6, carbohydrates_g: 3.1, fat_g: 8.6, sodium_mg: 67 },
    common_serving: { label_pt: "1 fatia (~30g)", grams: 30 },
    aliases: ["ricota", "queijo ricota", "ricotta"],
  },

  // --- Bebidas ---
  {
    taco_id: 568, name_pt: "Café, infusão 10%, com açúcar", name_en: "Coffee, infusion, with sugar", category: "bebidas",
    nutrients_per_100g: { calories_kcal: 9, protein_g: 0.1, carbohydrates_g: 2.3, fat_g: 0, sugar_g: 1.6, sodium_mg: 1 },
    common_serving: { label_pt: "1 xícara (~50 ml)", grams: 50 },
    aliases: ["cafezinho", "café com açúcar", "café com acucar", "coffee with sugar"],
  },
  {
    taco_id: 569, name_pt: "Café, infusão 10%, sem açúcar", name_en: "Coffee, black, no sugar", category: "bebidas",
    nutrients_per_100g: { calories_kcal: 1, protein_g: 0.1, carbohydrates_g: 0.2, fat_g: 0, sodium_mg: 1 },
    common_serving: { label_pt: "1 xícara (~50 ml)", grams: 50 },
    aliases: ["café preto", "cafe preto", "café sem açúcar", "café puro", "black coffee", "coffee"],
  },
  {
    taco_id: 580, name_pt: "Suco, laranja, natural", name_en: "Orange juice, natural", category: "bebidas",
    nutrients_per_100g: { calories_kcal: 41, protein_g: 0.7, carbohydrates_g: 9.4, fat_g: 0.1, sugar_g: 8.4, sodium_mg: 1 },
    common_serving: { label_pt: "1 copo (~200 ml)", grams: 200 },
    aliases: ["suco de laranja", "suco laranja natural", "orange juice"],
  },

  // --- Industrializados / lanches BR ---
  {
    taco_id: 612, name_pt: "Coxinha, frango", name_en: "Coxinha, chicken", category: "alimentos_industrializados",
    nutrients_per_100g: { calories_kcal: 257, protein_g: 9.5, carbohydrates_g: 28.6, fat_g: 11.7, sodium_mg: 511 },
    common_serving: { label_pt: "1 unidade média (~80g)", grams: 80 },
    aliases: ["coxinha", "coxinha de frango", "chicken croquette"],
  },
  {
    taco_id: 614, name_pt: "Brigadeiro", name_en: "Brigadeiro (Brazilian truffle)", category: "alimentos_industrializados",
    nutrients_per_100g: { calories_kcal: 388, protein_g: 6.0, carbohydrates_g: 62.0, fat_g: 13.0, sugar_g: 52.0, sodium_mg: 71 },
    common_serving: { label_pt: "1 unidade (~25g)", grams: 25 },
    aliases: ["brigadeiro", "negrinho", "chocolate truffle"],
  },
  {
    taco_id: 620, name_pt: "Feijoada, completa", name_en: "Feijoada, complete", category: "alimentos_industrializados",
    nutrients_per_100g: { calories_kcal: 117, protein_g: 8.4, carbohydrates_g: 6.6, fat_g: 6.4, fiber_g: 2.5, sodium_mg: 388 },
    common_serving: { label_pt: "1 prato fundo (~250g)", grams: 250 },
    aliases: ["feijoada", "feijoada completa"],
  },
  {
    taco_id: 624, name_pt: "Farofa, pronta", name_en: "Farofa (toasted cassava flour)", category: "alimentos_industrializados",
    nutrients_per_100g: { calories_kcal: 412, protein_g: 3.9, carbohydrates_g: 78.7, fat_g: 9.3, fiber_g: 5.5, sodium_mg: 442 },
    common_serving: { label_pt: "2 colheres de sopa (~30g)", grams: 30 },
    aliases: ["farofa", "farinha de mandioca temperada"],
  },

  // --- Expanded cereais ---
  { taco_id: 41, name_pt: "Granola, com frutas e mel", name_en: "Granola with fruit and honey", category: "cereais_e_derivados",
    nutrients_per_100g: { calories_kcal: 471, protein_g: 11.0, carbohydrates_g: 70.5, fat_g: 17.5, fiber_g: 7.4, sugar_g: 22.0, sodium_mg: 12 },
    common_serving: { label_pt: "1/2 xícara (~50g)", grams: 50 },
    aliases: ["granola", "granola com mel", "granola com frutas"] },
  { taco_id: 64, name_pt: "Biscoito, água e sal", name_en: "Cracker, water and salt", category: "cereais_e_derivados",
    nutrients_per_100g: { calories_kcal: 432, protein_g: 11.4, carbohydrates_g: 75.8, fat_g: 8.4, fiber_g: 2.6, sodium_mg: 758 },
    common_serving: { label_pt: "5 unidades (~25g)", grams: 25 },
    aliases: ["biscoito agua e sal", "biscoito cream cracker", "cream cracker", "cracker"] },
  { taco_id: 68, name_pt: "Biscoito, recheado, chocolate", name_en: "Cookie, chocolate filled", category: "cereais_e_derivados",
    nutrients_per_100g: { calories_kcal: 472, protein_g: 5.6, carbohydrates_g: 70.6, fat_g: 19.4, sugar_g: 33.5, sodium_mg: 248 },
    common_serving: { label_pt: "1 unidade (~13g)", grams: 13 },
    aliases: ["biscoito recheado", "bolacha recheada", "chocolate cookie"] },
  { taco_id: 92, name_pt: "Lasanha, congelada", name_en: "Lasagna, frozen", category: "cereais_e_derivados",
    nutrients_per_100g: { calories_kcal: 145, protein_g: 8.4, carbohydrates_g: 14.3, fat_g: 6.4, fiber_g: 1.0, sodium_mg: 365 },
    common_serving: { label_pt: "1 porção (~250g)", grams: 250 },
    aliases: ["lasanha", "lasagna", "lasanha congelada"] },

  // --- Expanded leguminosas ---
  { taco_id: 154, name_pt: "Feijão, branco, cozido", name_en: "White beans, cooked", category: "leguminosas_e_derivados",
    nutrients_per_100g: { calories_kcal: 95, protein_g: 6.4, carbohydrates_g: 17.0, fat_g: 0.5, fiber_g: 7.0, sodium_mg: 2 },
    common_serving: { label_pt: "1 concha (~120g)", grams: 120 },
    aliases: ["feijão branco", "feijao branco", "white beans", "navy beans"] },
  { taco_id: 162, name_pt: "Ervilha, cozida", name_en: "Peas, cooked", category: "leguminosas_e_derivados",
    nutrients_per_100g: { calories_kcal: 63, protein_g: 4.4, carbohydrates_g: 11.3, fat_g: 0.3, fiber_g: 4.5, sodium_mg: 4 },
    common_serving: { label_pt: "4 colheres de sopa (~80g)", grams: 80 },
    aliases: ["ervilha", "ervilhas", "peas", "ervilha cozida"] },

  // --- Expanded verduras e legumes ---
  { taco_id: 217, name_pt: "Espinafre, cozido", name_en: "Spinach, cooked", category: "verduras_e_legumes",
    nutrients_per_100g: { calories_kcal: 28, protein_g: 3.0, carbohydrates_g: 4.5, fat_g: 0.4, fiber_g: 2.8, sodium_mg: 8 },
    common_serving: { label_pt: "4 colheres de sopa (~80g)", grams: 80 },
    aliases: ["espinafre", "spinach"] },
  { taco_id: 221, name_pt: "Couve manteiga, refogada", name_en: "Kale, sautéed", category: "verduras_e_legumes",
    nutrients_per_100g: { calories_kcal: 90, protein_g: 4.5, carbohydrates_g: 11.5, fat_g: 4.5, fiber_g: 5.7, sodium_mg: 12 },
    common_serving: { label_pt: "4 colheres de sopa (~80g)", grams: 80 },
    aliases: ["couve", "couve refogada", "couve manteiga", "kale", "couve manteiga refogada"] },
  { taco_id: 235, name_pt: "Repolho, cru", name_en: "Cabbage, raw", category: "verduras_e_legumes",
    nutrients_per_100g: { calories_kcal: 26, protein_g: 1.4, carbohydrates_g: 5.4, fat_g: 0.2, fiber_g: 2.5, sodium_mg: 8 },
    common_serving: { label_pt: "1 prato pequeno (~80g)", grams: 80 },
    aliases: ["repolho", "cabbage"] },
  { taco_id: 240, name_pt: "Abobrinha, cozida", name_en: "Zucchini, cooked", category: "verduras_e_legumes",
    nutrients_per_100g: { calories_kcal: 16, protein_g: 1.2, carbohydrates_g: 3.0, fat_g: 0.2, fiber_g: 1.5, sodium_mg: 4 },
    common_serving: { label_pt: "1 unidade média (~150g)", grams: 150 },
    aliases: ["abobrinha", "zucchini", "courgette"] },
  { taco_id: 245, name_pt: "Pepino, cru", name_en: "Cucumber, raw", category: "verduras_e_legumes",
    nutrients_per_100g: { calories_kcal: 10, protein_g: 0.9, carbohydrates_g: 2.0, fat_g: 0.1, fiber_g: 1.0, sodium_mg: 4 },
    common_serving: { label_pt: "1 unidade média (~120g)", grams: 120 },
    aliases: ["pepino", "cucumber"] },
  { taco_id: 250, name_pt: "Beterraba, cozida", name_en: "Beetroot, cooked", category: "verduras_e_legumes",
    nutrients_per_100g: { calories_kcal: 32, protein_g: 1.3, carbohydrates_g: 7.2, fat_g: 0.1, fiber_g: 1.9, sodium_mg: 28 },
    common_serving: { label_pt: "4 colheres de sopa (~80g)", grams: 80 },
    aliases: ["beterraba", "beetroot", "beet"] },
  { taco_id: 254, name_pt: "Pimentão, verde, cru", name_en: "Bell pepper, green", category: "verduras_e_legumes",
    nutrients_per_100g: { calories_kcal: 21, protein_g: 0.9, carbohydrates_g: 4.7, fat_g: 0.2, fiber_g: 2.6, sodium_mg: 1 },
    common_serving: { label_pt: "1/2 unidade (~60g)", grams: 60 },
    aliases: ["pimentão", "pimentao", "bell pepper", "pimentão verde"] },
  { taco_id: 257, name_pt: "Cebola, crua", name_en: "Onion, raw", category: "verduras_e_legumes",
    nutrients_per_100g: { calories_kcal: 39, protein_g: 1.7, carbohydrates_g: 8.9, fat_g: 0.1, fiber_g: 2.2, sodium_mg: 3 },
    common_serving: { label_pt: "1 unidade pequena (~80g)", grams: 80 },
    aliases: ["cebola", "onion"] },
  { taco_id: 259, name_pt: "Alho, cru", name_en: "Garlic, raw", category: "verduras_e_legumes",
    nutrients_per_100g: { calories_kcal: 113, protein_g: 7.0, carbohydrates_g: 23.9, fat_g: 0.2, fiber_g: 4.3, sodium_mg: 7 },
    common_serving: { label_pt: "1 dente (~5g)", grams: 5 },
    aliases: ["alho", "garlic"] },
  { taco_id: 285, name_pt: "Milho, verde, cozido", name_en: "Sweet corn, cooked", category: "verduras_e_legumes",
    nutrients_per_100g: { calories_kcal: 98, protein_g: 3.3, carbohydrates_g: 21.2, fat_g: 1.0, fiber_g: 3.9, sodium_mg: 1 },
    common_serving: { label_pt: "4 colheres de sopa (~80g)", grams: 80 },
    aliases: ["milho", "milho verde", "milho cozido", "sweet corn", "corn"] },

  // --- Expanded frutas ---
  { taco_id: 360, name_pt: "Uva, italia", name_en: "Grapes (Italia)", category: "frutas_e_derivados",
    nutrients_per_100g: { calories_kcal: 53, protein_g: 0.7, carbohydrates_g: 13.6, fat_g: 0.3, fiber_g: 0.9, sugar_g: 12.4, sodium_mg: 1 },
    common_serving: { label_pt: "1 cacho pequeno (~120g)", grams: 120 },
    aliases: ["uva", "uvas", "grapes", "uva italia"] },
  { taco_id: 364, name_pt: "Pera, com casca", name_en: "Pear, with skin", category: "frutas_e_derivados",
    nutrients_per_100g: { calories_kcal: 53, protein_g: 0.4, carbohydrates_g: 14.0, fat_g: 0.1, fiber_g: 3.1, sugar_g: 9.8, sodium_mg: 0 },
    common_serving: { label_pt: "1 unidade média (~150g)", grams: 150 },
    aliases: ["pera", "peras", "pear"] },
  { taco_id: 370, name_pt: "Melão, cantaloupe, cru", name_en: "Cantaloupe, raw", category: "frutas_e_derivados",
    nutrients_per_100g: { calories_kcal: 29, protein_g: 0.7, carbohydrates_g: 7.5, fat_g: 0.1, fiber_g: 0.3, sugar_g: 6.6, sodium_mg: 11 },
    common_serving: { label_pt: "1 fatia (~150g)", grams: 150 },
    aliases: ["melão", "melao", "melon", "cantaloupe"] },
  { taco_id: 374, name_pt: "Pêssego, com casca", name_en: "Peach, with skin", category: "frutas_e_derivados",
    nutrients_per_100g: { calories_kcal: 36, protein_g: 0.8, carbohydrates_g: 9.5, fat_g: 0.1, fiber_g: 1.4, sugar_g: 8.0, sodium_mg: 0 },
    common_serving: { label_pt: "1 unidade média (~120g)", grams: 120 },
    aliases: ["pêssego", "pessego", "peach"] },
  { taco_id: 378, name_pt: "Maracujá, suco, sem açúcar", name_en: "Passion fruit juice", category: "frutas_e_derivados",
    nutrients_per_100g: { calories_kcal: 53, protein_g: 0.4, carbohydrates_g: 13.6, fat_g: 0.1, fiber_g: 0.6, sugar_g: 11.6, sodium_mg: 1 },
    common_serving: { label_pt: "1 copo (~200g)", grams: 200 },
    aliases: ["maracujá", "maracuja", "suco de maracujá", "passion fruit"] },
  { taco_id: 382, name_pt: "Goiaba, vermelha, com casca", name_en: "Guava, with skin", category: "frutas_e_derivados",
    nutrients_per_100g: { calories_kcal: 54, protein_g: 1.1, carbohydrates_g: 13.0, fat_g: 0.4, fiber_g: 6.3, sugar_g: 8.9, sodium_mg: 1 },
    common_serving: { label_pt: "1 unidade pequena (~80g)", grams: 80 },
    aliases: ["goiaba", "guava"] },
  { taco_id: 388, name_pt: "Coco, polpa, cru", name_en: "Coconut, fresh", category: "frutas_e_derivados",
    nutrients_per_100g: { calories_kcal: 354, protein_g: 3.3, carbohydrates_g: 15.2, fat_g: 33.5, fiber_g: 9.0, sodium_mg: 20 },
    common_serving: { label_pt: "1 fatia (~30g)", grams: 30 },
    aliases: ["coco", "coconut", "coco fresco"] },

  // --- Expanded carnes ---
  { taco_id: 410, name_pt: "Carne, bovina, alcatra, grelhada", name_en: "Sirloin steak, grilled", category: "carnes_e_derivados",
    nutrients_per_100g: { calories_kcal: 213, protein_g: 32.8, carbohydrates_g: 0, fat_g: 8.4, sodium_mg: 47 },
    common_serving: { label_pt: "1 bife (~120g)", grams: 120 },
    aliases: ["alcatra", "sirloin", "sirloin steak"] },
  { taco_id: 425, name_pt: "Hambúrguer, bovino, grelhado", name_en: "Beef hamburger, grilled", category: "carnes_e_derivados",
    nutrients_per_100g: { calories_kcal: 247, protein_g: 24.5, carbohydrates_g: 0.3, fat_g: 16.5, sodium_mg: 61 },
    common_serving: { label_pt: "1 unidade (~80g)", grams: 80 },
    aliases: ["hambúrguer", "hamburguer", "burger", "x-burger"] },
  { taco_id: 432, name_pt: "Presunto, cozido, magro", name_en: "Ham, cooked, lean", category: "carnes_e_derivados",
    nutrients_per_100g: { calories_kcal: 95, protein_g: 18.4, carbohydrates_g: 0, fat_g: 2.4, sodium_mg: 1238 },
    common_serving: { label_pt: "2 fatias (~30g)", grams: 30 },
    aliases: ["presunto", "ham", "presunto cozido"] },
  { taco_id: 438, name_pt: "Salsicha, hot dog", name_en: "Sausage (hot dog)", category: "carnes_e_derivados",
    nutrients_per_100g: { calories_kcal: 257, protein_g: 12.7, carbohydrates_g: 4.2, fat_g: 21.4, sodium_mg: 998 },
    common_serving: { label_pt: "1 unidade (~50g)", grams: 50 },
    aliases: ["salsicha", "salsichas", "hot dog", "sausage"] },
  { taco_id: 444, name_pt: "Linguiça, suína, frita", name_en: "Pork sausage, fried", category: "carnes_e_derivados",
    nutrients_per_100g: { calories_kcal: 296, protein_g: 14.5, carbohydrates_g: 0, fat_g: 26.0, sodium_mg: 825 },
    common_serving: { label_pt: "1 gomo (~70g)", grams: 70 },
    aliases: ["linguiça", "linguica", "linguiça calabresa", "calabresa", "pork sausage"] },
  { taco_id: 450, name_pt: "Mortadela", name_en: "Mortadella", category: "carnes_e_derivados",
    nutrients_per_100g: { calories_kcal: 269, protein_g: 13.5, carbohydrates_g: 1.0, fat_g: 23.0, sodium_mg: 1040 },
    common_serving: { label_pt: "2 fatias (~30g)", grams: 30 },
    aliases: ["mortadela", "mortadella", "bologna"] },
  { taco_id: 456, name_pt: "Peito de peru, defumado", name_en: "Smoked turkey breast", category: "carnes_e_derivados",
    nutrients_per_100g: { calories_kcal: 110, protein_g: 19.5, carbohydrates_g: 1.4, fat_g: 3.0, sodium_mg: 1010 },
    common_serving: { label_pt: "2 fatias (~30g)", grams: 30 },
    aliases: ["peito de peru", "peru defumado", "smoked turkey", "turkey breast"] },

  // --- Expanded pescados ---
  { taco_id: 478, name_pt: "Camarão, rosa, cozido", name_en: "Shrimp, cooked", category: "pescados",
    nutrients_per_100g: { calories_kcal: 90, protein_g: 17.4, carbohydrates_g: 0, fat_g: 2.0, sodium_mg: 224 },
    common_serving: { label_pt: "5-6 unidades (~80g)", grams: 80 },
    aliases: ["camarão", "camarao", "shrimp", "prawns"] },
  { taco_id: 481, name_pt: "Bacalhau, cozido", name_en: "Cod, cooked", category: "pescados",
    nutrients_per_100g: { calories_kcal: 105, protein_g: 22.8, carbohydrates_g: 0, fat_g: 0.9, sodium_mg: 78 },
    common_serving: { label_pt: "1 filé (~150g)", grams: 150 },
    aliases: ["bacalhau", "cod"] },

  // --- Expanded laticínios ---
  { taco_id: 545, name_pt: "Mussarela", name_en: "Mozzarella", category: "leite_e_derivados",
    nutrients_per_100g: { calories_kcal: 330, protein_g: 22.5, carbohydrates_g: 3.0, fat_g: 25.5, sodium_mg: 525 },
    common_serving: { label_pt: "1 fatia (~30g)", grams: 30 },
    aliases: ["mussarela", "mozzarella", "muçarela", "muzzarela"] },
  { taco_id: 547, name_pt: "Parmesão, ralado", name_en: "Parmesan, grated", category: "leite_e_derivados",
    nutrients_per_100g: { calories_kcal: 453, protein_g: 35.8, carbohydrates_g: 4.1, fat_g: 32.2, sodium_mg: 1602 },
    common_serving: { label_pt: "1 colher de sopa (~10g)", grams: 10 },
    aliases: ["parmesão", "parmesao", "parmesan"] },
  { taco_id: 551, name_pt: "Requeijão, cremoso", name_en: "Cream cheese", category: "leite_e_derivados",
    nutrients_per_100g: { calories_kcal: 257, protein_g: 9.6, carbohydrates_g: 3.4, fat_g: 23.0, sodium_mg: 526 },
    common_serving: { label_pt: "1 colher de sopa (~30g)", grams: 30 },
    aliases: ["requeijão", "requeijao", "catupiry", "cream cheese"] },
  { taco_id: 555, name_pt: "Manteiga, com sal", name_en: "Butter, with salt", category: "leite_e_derivados",
    nutrients_per_100g: { calories_kcal: 760, protein_g: 0.4, carbohydrates_g: 0, fat_g: 84.0, sodium_mg: 579 },
    common_serving: { label_pt: "1 colher de chá (~5g)", grams: 5 },
    aliases: ["manteiga", "butter", "manteiga com sal"] },
  { taco_id: 558, name_pt: "Leite condensado", name_en: "Condensed milk", category: "leite_e_derivados",
    nutrients_per_100g: { calories_kcal: 327, protein_g: 7.5, carbohydrates_g: 55.5, fat_g: 8.7, sugar_g: 55.5, sodium_mg: 130 },
    common_serving: { label_pt: "1 colher de sopa (~20g)", grams: 20 },
    aliases: ["leite condensado", "leite moça", "condensed milk"] },

  // --- Expanded bebidas ---
  { taco_id: 575, name_pt: "Refrigerante, cola, regular", name_en: "Cola soda, regular", category: "bebidas",
    nutrients_per_100g: { calories_kcal: 39, protein_g: 0, carbohydrates_g: 10.6, fat_g: 0, sugar_g: 10.6, sodium_mg: 4 },
    common_serving: { label_pt: "1 lata (~350 ml)", grams: 350 },
    aliases: ["coca cola", "coca-cola", "refrigerante", "soda", "guaraná"] },
  { taco_id: 583, name_pt: "Água de coco", name_en: "Coconut water", category: "bebidas",
    nutrients_per_100g: { calories_kcal: 22, protein_g: 0.2, carbohydrates_g: 5.3, fat_g: 0, sugar_g: 4.4, sodium_mg: 12 },
    common_serving: { label_pt: "1 copo (~250 ml)", grams: 250 },
    aliases: ["água de coco", "agua de coco", "coconut water"] },
  { taco_id: 586, name_pt: "Chá, verde, infusão", name_en: "Green tea infusion", category: "bebidas",
    nutrients_per_100g: { calories_kcal: 1, protein_g: 0.2, carbohydrates_g: 0, fat_g: 0, sodium_mg: 1 },
    common_serving: { label_pt: "1 xícara (~200 ml)", grams: 200 },
    aliases: ["chá verde", "cha verde", "green tea", "matcha infusion"] },

  // --- Expanded industrializados ---
  { taco_id: 627, name_pt: "Batata, frita, palito", name_en: "French fries", category: "alimentos_industrializados",
    nutrients_per_100g: { calories_kcal: 312, protein_g: 4.0, carbohydrates_g: 41.0, fat_g: 14.6, fiber_g: 4.4, sodium_mg: 168 },
    common_serving: { label_pt: "1 porção média (~150g)", grams: 150 },
    aliases: ["batata frita", "fritas", "french fries"] },
  { taco_id: 632, name_pt: "Pizza, mussarela", name_en: "Pizza, cheese", category: "alimentos_industrializados",
    nutrients_per_100g: { calories_kcal: 268, protein_g: 12.0, carbohydrates_g: 33.0, fat_g: 10.0, sodium_mg: 598 },
    common_serving: { label_pt: "1 fatia (~120g)", grams: 120 },
    aliases: ["pizza", "pizza margherita", "pizza mussarela", "pizza cheese"] },
  { taco_id: 638, name_pt: "Sorvete, baunilha", name_en: "Ice cream, vanilla", category: "alimentos_industrializados",
    nutrients_per_100g: { calories_kcal: 207, protein_g: 3.5, carbohydrates_g: 23.6, fat_g: 11.0, sugar_g: 21.2, sodium_mg: 80 },
    common_serving: { label_pt: "1 bola (~60g)", grams: 60 },
    aliases: ["sorvete", "ice cream", "sorvete baunilha"] },
  { taco_id: 644, name_pt: "Doce de leite, pastoso", name_en: "Dulce de leche", category: "alimentos_industrializados",
    nutrients_per_100g: { calories_kcal: 311, protein_g: 6.3, carbohydrates_g: 60.5, fat_g: 5.1, sugar_g: 56.0, sodium_mg: 138 },
    common_serving: { label_pt: "1 colher de sopa (~20g)", grams: 20 },
    aliases: ["doce de leite", "dulce de leche"] },
  { taco_id: 650, name_pt: "Chocolate, ao leite", name_en: "Milk chocolate", category: "alimentos_industrializados",
    nutrients_per_100g: { calories_kcal: 540, protein_g: 6.6, carbohydrates_g: 59.4, fat_g: 30.4, sugar_g: 51.5, sodium_mg: 96 },
    common_serving: { label_pt: "1 barra pequena (~25g)", grams: 25 },
    aliases: ["chocolate", "chocolate ao leite", "milk chocolate"] },
  { taco_id: 656, name_pt: "Açúcar, refinado", name_en: "Sugar, refined", category: "alimentos_industrializados",
    nutrients_per_100g: { calories_kcal: 387, protein_g: 0, carbohydrates_g: 99.6, fat_g: 0, sugar_g: 99.6, sodium_mg: 0 },
    common_serving: { label_pt: "1 colher de sopa (~12g)", grams: 12 },
    aliases: ["açúcar", "acucar", "açúcar refinado", "sugar"] },
  { taco_id: 660, name_pt: "Mel, de abelha", name_en: "Honey", category: "alimentos_industrializados",
    nutrients_per_100g: { calories_kcal: 309, protein_g: 0.5, carbohydrates_g: 84.0, fat_g: 0, sugar_g: 82.1, sodium_mg: 4 },
    common_serving: { label_pt: "1 colher de sopa (~20g)", grams: 20 },
    aliases: ["mel", "honey", "mel de abelha"] },
];
