export type ResponseFormat = "json" | "markdown";

export type ProviderSource = "usda" | "open_food_facts" | "manual" | "estimate";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "other";

export interface NutrientMap {
  calories_kcal?: number;
  protein_g?: number;
  carbohydrates_g?: number;
  fat_g?: number;
  fiber_g?: number;
  sugar_g?: number;
  saturated_fat_g?: number;
  sodium_mg?: number;
}

export interface SourceLicense {
  name: string;
  attribution: string;
  share_alike: boolean;
  url?: string;
}

export interface FoodItem {
  id: string;
  source: ProviderSource;
  source_id: string;
  source_url?: string;
  name: string;
  brand?: string;
  barcode?: string;
  locale?: string;
  serving?: string;
  available_portions: string[];
  nutrients_per_100g: NutrientMap;
  nutrients_per_serving?: NutrientMap;
  data_quality: "high" | "medium" | "low" | "unknown";
  license: SourceLicense;
}

export type SourceTrace =
  | {
      type: "food_ref";
      source: Exclude<ProviderSource, "manual" | "estimate">;
      source_id: string;
      food_id?: string;
    }
  | {
      type: "manual";
      description: string;
    }
  | {
      type: "estimate";
      description: string;
      assumptions: string[];
    };

export interface IntakeEntry {
  id: string;
  timestamp: string;
  date: string;
  meal_type: MealType;
  food_ref?: {
    source: Exclude<ProviderSource, "manual" | "estimate">;
    source_id: string;
  };
  custom_food?: string;
  quantity: number;
  unit: string;
  grams_estimate?: number;
  nutrients: NutrientMap;
  confidence: number;
  source_trace: SourceTrace;
  notes?: string;
  tags: string[];
  wellness_context_refs: string[];
}

export interface NourishConfig {
  local_dir: string;
  fixture_mode: boolean;
  usda_api_key?: string;
  off_enabled: boolean;
  cache_ttl_seconds: number;
  max_results: number;
}
