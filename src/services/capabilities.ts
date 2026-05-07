export interface NourishCapabilities {
  project: string;
  role: string;
  providers: {
    primary: string;
    optional_barcode: string;
    local_image_decode: string;
    vision_bridge: string;
    local_estimator: string;
    brazilian_local_catalog: string;
    personal_memory: string;
    coach_loop: string;
    bulk_imports: string;
  };
  workflows: string[];
  recommended_first_tools: string[];
}

export function buildCapabilities(): NourishCapabilities {
  return {
    project: "Nourish MCP",
    role: "nutrition intelligence adapter for agents and local-first humans",
    providers: {
      primary: "USDA FoodData Central",
      optional_barcode: "Open Food Facts",
      local_image_decode: "ZXing barcode decoding from local image paths, base64 images, or data URIs",
      vision_bridge: "Agent-provided photo observations, barcode observations, and label OCR routing; no automatic image upload or autonomous logging",
      local_estimator: "Deterministic simple-food estimator with common English and Brazilian Portuguese aliases and explicit gram parsing",
      brazilian_local_catalog: "Local Brazilian staples search for common foods and kitchen-unit estimates while a full TBCA/TACO provider remains opt-in future work",
      personal_memory: "Local remembered meals and aliases for personal Telegram shortcuts",
      coach_loop: "Read-only coaching tools that combine intake, goals, hydration, personal memory, and optional wearable context",
      bulk_imports: "OpenNutrition/Open Food Facts imports are separate opt-in flows",
    },
    workflows: [
      "food search",
      "Brazilian local food search",
      "Open Food Facts product name search",
      "barcode lookup",
      "barcode image decode and Open Food Facts lookup",
      "meal estimation",
      "photo-assisted meal estimation with confirmation-before-log",
      "mixed image routing for barcode, nutrition label OCR, and meal photo observations",
      "Brazilian Portuguese meal phrases for common foods and gram quantities",
      "local personal meal memory for repeated meals",
      "daily coach, next meal, pre-workout, after-log, and evening check-in loops",
      "local intake logging",
      "intake list, edit, delete, and clear-day workflows",
      "hydration and local nutrition goals",
      "daily and weekly summaries",
      "wearable-aware wellness context",
    ],
    recommended_first_tools: [
      "nourish_connection_status",
      "nourish_capabilities",
      "nourish_search_food",
    ],
  };
}
