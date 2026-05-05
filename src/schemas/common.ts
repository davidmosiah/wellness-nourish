import { z } from "zod";

const ResponseFormatSchema = z.enum(["json", "markdown"]);
const MealTypeSchema = z
  .enum(["breakfast", "lunch", "dinner", "snack", "other"])
  .default("other");
const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const NutrientMapSchema = z
  .object({
    calories_kcal: z.number().optional(),
    protein_g: z.number().optional(),
    carbohydrates_g: z.number().optional(),
    fat_g: z.number().optional(),
    fiber_g: z.number().optional(),
    sugar_g: z.number().optional(),
    saturated_fat_g: z.number().optional(),
    sodium_mg: z.number().optional(),
  })
  .strict();
const ProviderSourceSchema = z.enum(["usda", "open_food_facts", "manual", "estimate"]);
const FoodRefSchema = z
  .object({
    source: ProviderSourceSchema,
    source_id: z.string().trim().min(1),
    name: z.string().trim().min(1),
  })
  .strict();
const CustomFoodSchema = z
  .object({
    source: ProviderSourceSchema,
    source_id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    nutrients_per_100g: NutrientMapSchema,
  })
  .passthrough();

export const ResponseOnlyInputSchema = z
  .object({
    response_format: ResponseFormatSchema.default("json"),
  })
  .strict();

export const AgentManifestInputSchema = z
  .object({
    client: z
      .enum(["claude", "codex", "cursor", "windsurf", "hermes", "openclaw", "generic"])
      .default("generic"),
    response_format: ResponseFormatSchema.default("json"),
  })
  .strict();

export const FoodSearchInputSchema = z
  .object({
    query: z.string().trim().min(1),
    limit: z.number().int().min(1).max(25).default(10),
    provider: z.enum(["usda"]).default("usda"),
    response_format: ResponseFormatSchema.default("json"),
  })
  .strict();

export const BarcodeLookupInputSchema = z
  .object({
    barcode: z.string().regex(/^[0-9]{6,18}$/),
    response_format: ResponseFormatSchema.default("json"),
  })
  .strict();

export const FoodGetInputSchema = z
  .object({
    source: z.enum(["usda", "open_food_facts"]),
    source_id: z.string().trim().min(1),
    response_format: ResponseFormatSchema.default("json"),
  })
  .strict();

export const MealEstimateInputSchema = z
  .object({
    text: z.string().trim().min(1),
    locale: z.string().trim().min(2).default("en-US"),
    meal_type: MealTypeSchema,
    response_format: ResponseFormatSchema.default("json"),
  })
  .strict();

export const IntakeLogInputSchema = z
  .object({
    text: z.string().trim().min(1).optional(),
    food: z.unknown().optional(),
    timestamp: z.string().datetime().optional(),
    meal_type: MealTypeSchema,
    food_ref: FoodRefSchema.optional(),
    custom_food: CustomFoodSchema.optional(),
    quantity: z.number().positive().optional(),
    unit: z.string().trim().min(1).optional(),
    grams_estimate: z.number().positive().optional(),
    nutrients: NutrientMapSchema.optional(),
    confidence: z.number().min(0).max(1).optional(),
    explicit_user_intent: z.boolean().default(false),
    notes: z.string().trim().optional(),
    tags: z.array(z.string().trim().min(1)).default([]),
    wellness_context_refs: z.array(z.string().trim().min(1)).default([]),
    response_format: ResponseFormatSchema.default("json"),
  })
  .strict()
  .superRefine((input, ctx) => {
    const hasMeaningfulFood =
      typeof input.food === "object" &&
      input.food !== null &&
      !Array.isArray(input.food) &&
      (hasNonEmptyStringProperty(input.food, "source_id") ||
        hasNonEmptyStringProperty(input.food, "name"));
    const hasMeaningfulCustomFood = input.custom_food !== undefined;

    if (!input.text && !input.food_ref && !hasMeaningfulCustomFood && !hasMeaningfulFood) {
      ctx.addIssue({
        code: "custom",
        message: "At least one meaningful intake input is required.",
        path: ["text"],
      });
    }

    if (input.explicit_user_intent !== true) {
      ctx.addIssue({
        code: "custom",
        message: "explicit_user_intent must be true to log intake.",
        path: ["explicit_user_intent"],
      });
    }
  });

function hasNonEmptyStringProperty(value: object, key: string): boolean {
  const property = (value as Record<string, unknown>)[key];

  return typeof property === "string" && property.trim().length > 0;
}

export const IntakeUpdateInputSchema = z
  .object({
    id: z.string().trim().min(1),
    meal_type: z.enum(["breakfast", "lunch", "dinner", "snack", "other"]).optional(),
    quantity: z.number().positive().optional(),
    unit: z.string().trim().min(1).optional(),
    timestamp: z.string().datetime().optional(),
    notes: z.string().trim().optional(),
    tags: z.array(z.string().trim().min(1)).optional(),
    response_format: ResponseFormatSchema.default("json"),
  })
  .strict();

export const IntakeDeleteInputSchema = z
  .object({
    id: z.string().trim().min(1),
    response_format: ResponseFormatSchema.default("json"),
  })
  .strict();

export const SummaryInputSchema = z
  .object({
    date: DateSchema.optional(),
    response_format: ResponseFormatSchema.default("json"),
  })
  .strict();

export const WeeklySummaryInputSchema = z
  .object({
    start_date: DateSchema.optional(),
    response_format: ResponseFormatSchema.default("json"),
  })
  .strict();
