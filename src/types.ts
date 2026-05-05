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
  serving?: {
    quantity: number;
    unit: string;
    grams?: number;
  };
  available_portions: Array<{
    label: string;
    quantity: number;
    unit: string;
    grams?: number;
  }>;
  nutrients_per_100g: NutrientMap;
  nutrients_per_serving?: NutrientMap;
  data_quality: {
    completeness: "low" | "medium" | "high";
    confidence: number;
    warnings: string[];
  };
  license: SourceLicense;
}

export interface IntakeEntry {
  id: string;
  timestamp: string;
  date: string;
  meal_type: MealType;
  food_ref?: {
    source: ProviderSource;
    source_id: string;
    name: string;
  };
  custom_food?: FoodItem;
  quantity: number;
  unit: string;
  grams_estimate?: number;
  nutrients: NutrientMap;
  confidence: number;
  source_trace: "exact_food" | "barcode" | "estimate" | "manual" | "agent_inference";
  notes?: string;
  tags: string[];
  wellness_context_refs: string[];
}

export interface HydrationEntry {
  id: string;
  timestamp: string;
  date: string;
  amount_ml: number;
  source: "manual" | "agent";
  notes?: string;
}

export interface HydrationSummary {
  date: string;
  total_ml: number;
  goal_ml?: number;
  progress_percent?: number;
  entries: HydrationEntry[];
}

export interface NourishGoals {
  daily: NutrientMap;
  hydration_ml?: number;
  updated_at?: string;
}

export interface NourishConfig {
  local_dir: string;
  fixture_mode: boolean;
  usda_api_key?: string;
  off_enabled: boolean;
  cache_ttl_seconds: number;
  max_results: number;
}
