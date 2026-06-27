import { lookupOpenFoodFactsBarcode } from "../providers/open-food-facts.js";
import { foodCompleteness, makeFoodId } from "./food-normalization.js";
import { estimateMealFromPhotoObservation, type PhotoMealDetectedItem } from "./photo-meal-estimator.js";
import { nutrientsForGrams } from "./portion-engine.js";
import type { FoodItem, MealType, NutrientMap } from "../types.js";

export interface FoodImageAnalysisInput {
  image_description?: string | undefined;
  barcode_observation?: string | undefined;
  detected_barcodes?: string[] | undefined;
  barcode?: string | undefined;
  detected_items?: PhotoMealDetectedItem[] | undefined;
  nutrition_label_text?: string | undefined;
  product_name?: string | undefined;
  locale: string;
  meal_type: MealType;
}

export type FoodImageRoute =
  | "barcode"
  | "nutrition_label"
  | "meal_photo"
  | "needs_more_detail"
  | "needs_more_ocr";

function hasMeaningfulNutrients(nutrients: NutrientMap): boolean {
  return Object.values(nutrients).some(
    (value) => typeof value === "number" && Number.isFinite(value) && value > 0,
  );
}

function confirmBeforeLoggingAction(): string {
  return "Ask the user to confirm the product, serving size, and save intent before calling nourish_log_intake.";
}

function barcodeFallbackActions(barcode?: string): string[] {
  const retry = barcode === undefined
    ? "Ask the user for a sharper, flatter barcode photo with the full barcode and printed digits visible."
    : `Barcode ${barcode} did not resolve. Ask the user to confirm the printed digits or provide a sharper product photo.`;
  return [
    retry,
    "If the barcode remains unreadable, ask the user to type the digits and call nourish_lookup_barcode.",
    "If a nutrition label is readable, OCR it and call nourish_analyze_food_image with product_name and nutrition_label_text.",
    "If this is an unpackaged meal, describe visible foods and portions, then call nourish_analyze_food_image with detected_items or image_description.",
    confirmBeforeLoggingAction(),
  ];
}

export async function analyzeFoodImage(input: FoodImageAnalysisInput): Promise<Record<string, unknown>> {
  const barcode = input.barcode ?? input.detected_barcodes?.[0];
  const hasLabelText =
    input.nutrition_label_text !== undefined && input.nutrition_label_text.trim().length > 0;
  const hasBarcodeObservation =
    input.barcode_observation !== undefined && input.barcode_observation.trim().length > 0;
  const detectedItems = input.detected_items ?? [];
  const hasMealHint = detectedItems.length > 0 || input.image_description !== undefined;

  if (barcode !== undefined) {
    try {
      const lookup = await lookupOpenFoodFactsBarcode(barcode);
      return {
        route: "barcode" satisfies FoodImageRoute,
        requires_confirmation: true,
        barcode,
        barcode_lookup: lookup,
        suggested_log_intake: {
          food_ref: {
            source: lookup.food.source,
            source_id: lookup.food.source_id,
            name: lookup.food.name,
          },
          quantity: 1,
          unit: "serving",
          explicit_user_intent: false,
        },
        warnings: [
          "Confirm the product and serving size before logging.",
        ],
        next_actions: [
          confirmBeforeLoggingAction(),
        ],
      };
    } catch (error) {
      // N-008 fix: barcode lookup failed but the agent gave us OCR or meal
      // hints in the same call — fall through and use them rather than
      // failing the whole image-analysis call.
      const fallbackWarnings = [
        `Open Food Facts barcode lookup for ${barcode} failed: ${(error as Error).message}`,
      ];

      if (hasLabelText) {
        const result = nutritionLabelRoute(input);
        return {
          ...result,
          barcode_attempted: barcode,
          fallback_used: "nutrition_label_text",
          warnings: [...fallbackWarnings, ...((result.warnings as string[] | undefined) ?? [])],
          next_actions: [
            ...(((result.next_actions as string[] | undefined) ?? [])),
            "Tell the user the barcode lookup failed, so the estimate is coming from OCR label text.",
          ],
        };
      }

      if (hasMealHint) {
        const result = await mealPhotoRoute(input, detectedItems);
        return {
          ...result,
          barcode_attempted: barcode,
          fallback_used: "meal_photo",
          warnings: [...fallbackWarnings, ...((result.warnings as string[] | undefined) ?? [])],
          next_actions: [
            ...(((result.next_actions as string[] | undefined) ?? [])),
            "Tell the user the barcode lookup failed, so the estimate is coming from visible meal items.",
          ],
        };
      }

      // No fallback signal available — surface the barcode failure cleanly.
      return {
        route: "needs_more_detail" satisfies FoodImageRoute,
        requires_confirmation: true,
        barcode_attempted: barcode,
        fallback_options: [
          "typed barcode digits",
          "product_name plus nutrition_label_text",
          "detected_items with portions",
          "image_description for a meal photo",
        ],
        warnings: [
          ...fallbackWarnings,
          "Provide nutrition_label_text, detected_items, or image_description so the agent can fall back when the barcode lookup is down.",
        ],
        next_actions: barcodeFallbackActions(barcode),
      };
    }
  }

  if (hasLabelText) {
    const result = nutritionLabelRoute(input);
    return hasBarcodeObservation
      ? {
          ...result,
          barcode_observation: input.barcode_observation,
          fallback_used: "nutrition_label_text",
        }
      : result;
  }

  if (hasMealHint) {
    const result = await mealPhotoRoute(input, detectedItems);
    return hasBarcodeObservation
      ? {
          ...result,
          barcode_observation: input.barcode_observation,
          fallback_used: "meal_photo",
        }
      : result;
  }

  if (hasBarcodeObservation) {
    return {
      route: "needs_more_detail" satisfies FoodImageRoute,
      requires_confirmation: true,
      barcode_observation: input.barcode_observation,
      fallback_options: [
        "typed barcode digits",
        "product_name plus nutrition_label_text",
        "detected_items with portions",
        "image_description for a meal photo",
      ],
      warnings: [
        "Barcode was observed but could not be read from the image.",
      ],
      next_actions: barcodeFallbackActions(),
    };
  }

  return {
    route: "needs_more_detail" satisfies FoodImageRoute,
    requires_confirmation: true,
    warnings: [
      "Provide a barcode, nutrition label OCR text, detected meal items, or an image description.",
    ],
    next_actions: barcodeFallbackActions(),
  };
}

function nutritionLabelRoute(input: FoodImageAnalysisInput): Record<string, unknown> {
  const labelFood = foodFromNutritionLabel(
    input.product_name ?? productNameFromDescription(input.image_description) ?? "Nutrition label product",
    input.nutrition_label_text ?? "",
  );

  // N-009 fix: if the OCR text didn't yield any usable nutrients (every
  // pattern failed), don't suggest logging — that would write `nutrients:{}`
  // which is exactly the broken state PR #7 N-001 is preventing.
  if (!hasMeaningfulNutrients(labelFood.nutrients_per_serving ?? {})) {
    return {
      route: "needs_more_ocr" satisfies FoodImageRoute,
      requires_confirmation: true,
      label_food: labelFood,
      ocr_input: input.nutrition_label_text,
      warnings: [
        "Nutrition label OCR did not yield any usable nutrient values — refine the OCR text or provide nutrients explicitly before logging.",
        "No suggested_log_intake was emitted because logging an entry with empty nutrients would corrupt the daily summary.",
      ],
      next_actions: [
        "Ask for a sharper nutrition facts photo or rerun OCR with calories, serving size, protein, carbs, fat and sodium visible.",
        "Do not call nourish_log_intake until nutrition values are parseable and the user confirms saving.",
      ],
    };
  }

  return {
    route: "nutrition_label" satisfies FoodImageRoute,
    requires_confirmation: true,
    label_food: labelFood,
    suggested_log_intake: {
      custom_food: labelFood,
      quantity: 1,
      unit: "serving",
      explicit_user_intent: false,
    },
    warnings: [
      "Nutrition label OCR can be imperfect; confirm serving size and nutrients before logging.",
    ],
    next_actions: [
      confirmBeforeLoggingAction(),
    ],
  };
}

async function mealPhotoRoute(
  input: FoodImageAnalysisInput,
  detectedItems: PhotoMealDetectedItem[],
): Promise<Record<string, unknown>> {
  const estimate = await estimateMealFromPhotoObservation({
    image_description: input.image_description ?? detectedItems.map((item) => item.name).join(", "),
    detected_items: detectedItems,
    locale: input.locale,
    meal_type: input.meal_type,
  });

  return {
    route: "meal_photo" satisfies FoodImageRoute,
    requires_confirmation: true,
    meal_estimate: estimate,
    suggested_log_intake: estimate.suggested_log_intake,
    warnings: estimate.warnings,
    next_actions: [
      "Ask the user to confirm visible foods, portions, and save intent before logging.",
    ],
  };
}

function foodFromNutritionLabel(productName: string, labelText: string): FoodItem {
  const servingGrams = parseServingGrams(labelText) ?? 100;
  const nutrientsPerServing = parseLabelNutrients(labelText);
  const nutrientsPer100g = nutrientsForGrams(nutrientsPerServing, 100 / servingGrams * 100);
  const sourceId = `label:${Buffer.from(`${productName}:${labelText}`).toString("base64url").slice(0, 48)}`;
  const itemBase: Omit<FoodItem, "data_quality"> = {
    id: makeFoodId("manual", sourceId),
    source: "manual",
    source_id: sourceId,
    name: productName,
    serving: {
      quantity: 1,
      unit: "serving",
      grams: servingGrams,
    },
    available_portions: [
      {
        label: "serving",
        quantity: 1,
        unit: "serving",
        grams: servingGrams,
      },
      {
        label: "100g",
        quantity: 100,
        unit: "g",
        grams: 100,
      },
    ],
    nutrients_per_100g: nutrientsPer100g,
    nutrients_per_serving: nutrientsPerServing,
    license: {
      name: "User-provided nutrition label",
      attribution: "Nutrition facts were extracted from user-provided label text.",
      share_alike: false,
    },
  };

  return {
    ...itemBase,
    data_quality: {
      completeness: foodCompleteness(itemBase),
      confidence: 0.6,
      warnings: [
        "Parsed from user/agent OCR label text; verify serving size and nutrients.",
      ],
    },
  };
}

function parseLabelNutrients(labelText: string): NutrientMap {
  return {
    ...optionalNutrient("calories_kcal", parseNumberAfter(labelText, [
      /(?:valor\s+energ[eé]tico|calorias|kcal)[^\d]*(\d+(?:[,.]\d+)?)/iu,
      /(\d+(?:[,.]\d+)?)\s*kcal/iu,
    ])),
    ...optionalNutrient("carbohydrates_g", parseNumberAfter(labelText, [
      /carboidratos?[^\d]*(\d+(?:[,.]\d+)?)\s*g/iu,
      /carbs?[^\d]*(\d+(?:[,.]\d+)?)\s*g/iu,
    ])),
    ...optionalNutrient("protein_g", parseNumberAfter(labelText, [
      /prote[ií]nas?[^\d]*(\d+(?:[,.]\d+)?)\s*g/iu,
      /protein[^\d]*(\d+(?:[,.]\d+)?)\s*g/iu,
    ])),
    ...optionalNutrient("fat_g", parseNumberAfter(labelText, [
      /gorduras?\s+totais[^\d]*(\d+(?:[,.]\d+)?)\s*g/iu,
      /fat[^\d]*(\d+(?:[,.]\d+)?)\s*g/iu,
    ])),
    ...optionalNutrient("fiber_g", parseNumberAfter(labelText, [
      /fibras?[^\d]*(\d+(?:[,.]\d+)?)\s*g/iu,
      /fiber[^\d]*(\d+(?:[,.]\d+)?)\s*g/iu,
    ])),
    ...optionalNutrient("sugar_g", parseNumberAfter(labelText, [
      /a[cç][uú]cares?[^\d]*(\d+(?:[,.]\d+)?)\s*g/iu,
      /sugars?[^\d]*(\d+(?:[,.]\d+)?)\s*g/iu,
    ])),
    ...optionalNutrient("sodium_mg", parseNumberAfter(labelText, [
      /s[oó]dio[^\d]*(\d+(?:[,.]\d+)?)\s*mg/iu,
      /sodium[^\d]*(\d+(?:[,.]\d+)?)\s*mg/iu,
    ])),
  };
}

function parseServingGrams(labelText: string): number | undefined {
  return parseNumberAfter(labelText, [
    /por[cç][aã]o[^\d]*(\d+(?:[,.]\d+)?)\s*g/iu,
    /serving[^\d]*(\d+(?:[,.]\d+)?)\s*g/iu,
  ]);
}

function parseNumberAfter(text: string, patterns: RegExp[]): number | undefined {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    const raw = match?.[1];
    if (raw === undefined) {
      continue;
    }

    const parsed = Number.parseFloat(raw.replace(",", "."));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function optionalNutrient<K extends keyof NutrientMap>(
  key: K,
  value: number | undefined,
): Partial<Pick<NutrientMap, K>> {
  return value === undefined ? {} : { [key]: value } as Partial<Pick<NutrientMap, K>>;
}

function productNameFromDescription(description: string | undefined): string | undefined {
  if (description === undefined || description.trim().length === 0) {
    return undefined;
  }

  return description.trim().slice(0, 80);
}
