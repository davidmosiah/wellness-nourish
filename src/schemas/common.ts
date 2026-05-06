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
const ExplicitUserIntentSchema = z
  .boolean()
  .default(false)
  .describe("Pass true only after the user explicitly asked to save, log, set, or delete this personal nutrition data.");
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

export const IntakeListInputSchema = z
  .object({
    date: DateSchema.optional(),
    response_format: ResponseFormatSchema.default("json"),
  })
  .strict();

export const ClearDayInputSchema = z
  .object({
    date: DateSchema,
    explicit_user_intent: ExplicitUserIntentSchema,
    response_format: ResponseFormatSchema.default("json"),
  })
  .strict();

export const HydrationLogInputSchema = z
  .object({
    amount_ml: z.number().positive(),
    timestamp: z.string().datetime().optional(),
    date: DateSchema.optional(),
    notes: z.string().trim().optional(),
    explicit_user_intent: ExplicitUserIntentSchema,
    response_format: ResponseFormatSchema.default("json"),
  })
  .strict();

export const GoalsSetInputSchema = z
  .object({
    daily: NutrientMapSchema.optional().describe("Nested daily nutrient goals, for example { calories_kcal, protein_g, carbohydrates_g, fat_g }."),
    calories_kcal: z.number().positive().optional().describe("Flat shortcut for daily.calories_kcal."),
    protein_g: z.number().positive().optional().describe("Flat shortcut for daily.protein_g."),
    carbohydrates_g: z.number().positive().optional().describe("Flat shortcut for daily.carbohydrates_g."),
    fat_g: z.number().positive().optional().describe("Flat shortcut for daily.fat_g."),
    fiber_g: z.number().positive().optional().describe("Flat shortcut for daily.fiber_g."),
    sugar_g: z.number().positive().optional().describe("Flat shortcut for daily.sugar_g."),
    hydration_ml: z.number().positive().optional().describe("Daily hydration target in milliliters."),
    explicit_user_intent: ExplicitUserIntentSchema,
    response_format: ResponseFormatSchema.default("json"),
  })
  .strict()
  .superRefine((input, ctx) => {
    const hasFlatDaily = [
      input.calories_kcal,
      input.protein_g,
      input.carbohydrates_g,
      input.fat_g,
      input.fiber_g,
      input.sugar_g,
    ].some((value) => value !== undefined);

    if (input.daily === undefined && input.hydration_ml === undefined && !hasFlatDaily) {
      ctx.addIssue({
        code: "custom",
        message: "Provide daily nutrients, flat daily nutrient shortcuts, or hydration_ml.",
        path: ["daily"],
      });
    }
  });

export const ExportInputSchema = z
  .object({
    export_format: z.enum(["jsonl", "csv"]).default("jsonl"),
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

const ImageInputFields = {
  image_path: z.string().trim().min(1).optional(),
  image_base64: z.string().trim().min(1).optional(),
  image_data_uri: z.string().trim().min(1).optional(),
  image_mime_type: z.string().trim().min(1).optional(),
} as const;

export const BarcodeImageDecodeInputSchema = z
  .object({
    ...ImageInputFields,
    response_format: ResponseFormatSchema.default("json"),
  })
  .strict()
  .superRefine(requireExactlyOneImageInput);

export const BarcodeImageLookupInputSchema = z
  .object({
    ...ImageInputFields,
    response_format: ResponseFormatSchema.default("json"),
  })
  .strict()
  .superRefine(requireExactlyOneImageInput);

export const FoodGetInputSchema = z
  .object({
    source: z.enum(["usda", "open_food_facts"]),
    source_id: z.string().trim().min(1),
    response_format: ResponseFormatSchema.default("json"),
  })
  .strict();

export const MealEstimateInputSchema = z
  .object({
    text: z.string().trim().min(1).optional().describe("Meal text to estimate, for example 'pão de queijo, café preto, banana'."),
    meal_text: z.string().trim().min(1).optional().describe("Alias for text for agents that naturally call this parameter meal_text."),
    locale: z.string().trim().min(2).default("en-US"),
    meal_type: MealTypeSchema,
    response_format: ResponseFormatSchema.default("json"),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.text === undefined && input.meal_text === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Provide text or meal_text.",
        path: ["text"],
      });
    }
  });

const PhotoMealDetectedItemSchema = z
  .object({
    name: z.string().trim().min(1),
    quantity: z.number().positive().optional(),
    unit: z.string().trim().min(1).optional(),
    grams_estimate: z.number().positive().optional(),
    confidence: z.number().min(0).max(1).optional(),
  })
  .strict();

export const PhotoMealEstimateInputSchema = z
  .object({
    image_description: z.string().trim().min(1),
    detected_items: z.array(PhotoMealDetectedItemSchema).max(25).default([]),
    locale: z.string().trim().min(2).default("en-US"),
    meal_type: MealTypeSchema,
    response_format: ResponseFormatSchema.default("json"),
  })
  .strict();

export const IntakeLogInputSchema = z
  .object({
    text: z.string().trim().min(1).optional().describe("Meal text to estimate and log after confirmation."),
    meal_text: z.string().trim().min(1).optional().describe("Alias for text; use when the agent planned a meal_text argument."),
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
    explicit_user_intent: ExplicitUserIntentSchema,
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

    if (!input.text && !input.meal_text && !input.food_ref && !hasMeaningfulCustomFood && !hasMeaningfulFood) {
      ctx.addIssue({
        code: "custom",
        message: "At least one meaningful intake input is required.",
        path: ["text"],
      });
    }

  });

function hasNonEmptyStringProperty(value: object, key: string): boolean {
  const property = (value as Record<string, unknown>)[key];

  return typeof property === "string" && property.trim().length > 0;
}

function requireExactlyOneImageInput(
  input: {
    image_path?: string | undefined;
    image_base64?: string | undefined;
    image_data_uri?: string | undefined;
  },
  ctx: z.RefinementCtx,
): void {
  const count = [input.image_path, input.image_base64, input.image_data_uri].filter(
    (value) => value !== undefined && value.trim().length > 0,
  ).length;

  if (count !== 1) {
    ctx.addIssue({
      code: "custom",
      message: "Provide exactly one of image_path, image_base64, or image_data_uri.",
      path: ["image_path"],
    });
  }
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
