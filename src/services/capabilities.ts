export interface NourishCapabilities {
  project: string;
  role: string;
  providers: {
    primary: string;
    optional_barcode: string;
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
      bulk_imports: "OpenNutrition/Open Food Facts imports are separate opt-in flows",
    },
    workflows: [
      "food search",
      "barcode lookup",
      "meal estimation",
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
