import type { MealType } from "../types.js";
import { estimateMeal, type MealEstimate } from "./meal-estimator.js";

export interface PhotoMealDetectedItem {
  name: string;
  quantity?: number | undefined;
  unit?: string | undefined;
  grams_estimate?: number | undefined;
  confidence?: number | undefined;
}

export interface PhotoMealEstimateInput {
  image_description: string;
  detected_items?: PhotoMealDetectedItem[] | undefined;
  meal_type: MealType;
  locale: string;
}

export interface PhotoMealEstimate {
  source: "agent_vision_observation";
  requires_confirmation: true;
  can_log_without_confirmation: false;
  image_description: string;
  detected_items: PhotoMealDetectedItem[];
  estimate: MealEstimate;
  suggested_log_intake: {
    text: string;
    meal_type: MealType;
    confidence: number;
    tags: string[];
    explicit_user_intent: false;
  };
  warnings: string[];
}

export async function estimateMealFromPhotoObservation(
  input: PhotoMealEstimateInput,
): Promise<PhotoMealEstimate> {
  const detectedItems = input.detected_items ?? [];
  const text = detectedItems.length > 0
    ? detectedItems.map(itemToMealText).join(" and ")
    : input.image_description;
  const estimate = await estimateMeal({
    text,
    locale: input.locale,
    meal_type: input.meal_type,
  });
  const confidence = photoConfidence(estimate.confidence, detectedItems);
  const warnings = [
    "Photo-based nutrition estimates are approximate and depend on the agent's visual interpretation.",
    "Ask the user to confirm portions before logging intake.",
    ...estimate.warnings,
  ];

  return {
    source: "agent_vision_observation",
    requires_confirmation: true,
    can_log_without_confirmation: false,
    image_description: input.image_description,
    detected_items: detectedItems,
    estimate: {
      ...estimate,
      confidence,
      warnings,
    },
    suggested_log_intake: {
      text,
      meal_type: input.meal_type,
      confidence,
      tags: ["photo_estimate"],
      explicit_user_intent: false,
    },
    warnings,
  };
}

function itemToMealText(item: PhotoMealDetectedItem): string {
  if (item.grams_estimate !== undefined) {
    return `${item.grams_estimate} g ${item.name}`;
  }

  if (item.quantity !== undefined && item.unit !== undefined) {
    return `${item.quantity} ${item.unit} ${item.name}`;
  }

  if (item.quantity !== undefined) {
    return `${item.quantity} ${item.name}`;
  }

  return item.name;
}

function photoConfidence(baseConfidence: number, detectedItems: PhotoMealDetectedItem[]): number {
  if (detectedItems.length === 0) {
    return Math.min(baseConfidence, 0.2);
  }

  const visualConfidence =
    detectedItems.reduce((total, item) => total + (item.confidence ?? 0.45), 0) / detectedItems.length;
  return Math.round(Math.min(baseConfidence, visualConfidence, 0.48) * 100) / 100;
}
