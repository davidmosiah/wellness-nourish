import type { NutrientMap, ResponseFormat } from "../types.js";

export interface McpTextResponse {
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  content: Array<{
    type: "text";
    text: string;
  }>;
}

export function makeResponse(
  payload: unknown,
  responseFormat: ResponseFormat = "json",
  markdown?: string,
): McpTextResponse {
  const text =
    responseFormat === "markdown"
      ? (markdown ?? bulletList("Nourish", payload))
      : JSON.stringify(payload);

  const structuredContent = payload !== null && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : undefined;

  return {
    ...(structuredContent === undefined ? {} : { structuredContent }),
    content: [{ type: "text", text }],
  };
}

export function makeError(message: string): McpTextResponse;
export function makeError(
  code: string,
  message: string,
  responseFormat?: ResponseFormat,
): McpTextResponse;
export function makeError(
  first: string,
  second?: string,
  responseFormat: ResponseFormat = "json",
): McpTextResponse {
  const code = second === undefined ? "NOURISH_ERROR" : first;
  const message = second ?? first;
  const payload = {
    ok: false,
    error: {
      code,
      message,
    },
  };
  const markdown = `# Error\n\n- **code**: ${code}\n- **message**: ${message}`;
  const response = makeResponse(payload, responseFormat, markdown);

  return {
    ...response,
    isError: true,
  };
}

export function makeActionRequired(message: string, responseFormat: ResponseFormat = "json"): McpTextResponse {
  const payload = {
    ok: false,
    error: {
      code: "USER_ACTION_REQUIRED",
      message,
    },
    action_required: true,
  };
  const markdown = `# Action Required\n\n- **code**: USER_ACTION_REQUIRED\n- **message**: ${message}`;

  return makeResponse(payload, responseFormat, markdown);
}

export function makeValidationError(
  errors: Array<{ path: string; message: string; code?: string | undefined }>,
  responseFormat: ResponseFormat = "json",
): McpTextResponse {
  const payload = {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Invalid Nourish tool input.",
      errors,
    },
  };
  const markdown = [
    "# Validation Error",
    "",
    ...errors.map((error) => `- **${error.path || "input"}**: ${error.message}`),
  ].join("\n");
  const response = makeResponse(payload, responseFormat, markdown);

  return {
    ...response,
    isError: true,
  };
}

export function bulletList(title: string, values: Record<string, unknown> | unknown): string {
  const lines = [`# ${title}`];
  const entries =
    values !== null && typeof values === "object" && !Array.isArray(values)
      ? Object.entries(values as Record<string, unknown>)
      : [["value", values] as const];

  for (const [key, value] of entries) {
    lines.push(`- ${key}: ${formatValue(value)}`);
  }

  return lines.join("\n");
}

export function compactTable(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  if (rows.length === 0) {
    return "";
  }

  const headers = columns ?? Object.keys(rows[0] ?? {});
  const header = `| ${headers.join(" | ")} |`;
  const divider = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${headers.map((key) => formatValue(row[key])).join(" | ")} |`);

  return [header, divider, ...body].join("\n");
}

// Human-friendly labels (with units) for the tracked nutrient keys. Keeps the
// prose/table formatters from leaking machine keys like `calories_kcal` into
// chat surfaces. Anything not listed falls back to a title-cased key.
const NUTRIENT_LABELS: Record<string, string> = {
  calories_kcal: "Calories (kcal)",
  protein_g: "Protein (g)",
  carbohydrates_g: "Carbs (g)",
  fat_g: "Fat (g)",
  fiber_g: "Fiber (g)",
  sugar_g: "Sugar (g)",
  saturated_fat_g: "Saturated fat (g)",
  sodium_mg: "Sodium (mg)",
};

const NUTRIENT_ORDER = [
  "calories_kcal",
  "protein_g",
  "carbohydrates_g",
  "fat_g",
  "fiber_g",
  "sugar_g",
  "saturated_fat_g",
  "sodium_mg",
] as const;

function nutrientLabel(key: string): string {
  return (
    NUTRIENT_LABELS[key] ??
    key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

/**
 * Render a nutrient map as a readable two-column markdown table instead of a
 * one-line JSON blob. Skips undefined/null values, keeps a stable nutrient
 * order, and appends any extra numeric keys not in the canonical order.
 * Returns "" when there is nothing meaningful to show.
 */
export function nutrientTable(
  nutrients: NutrientMap | Record<string, unknown> | undefined,
  valueHeader = "Amount",
): string {
  if (nutrients === null || typeof nutrients !== "object") {
    return "";
  }

  const record = nutrients as Record<string, unknown>;
  const orderedKeys = [
    ...NUTRIENT_ORDER.filter((key) => key in record),
    ...Object.keys(record).filter((key) => !(NUTRIENT_ORDER as readonly string[]).includes(key)),
  ];

  const rows = orderedKeys
    .map((key) => ({ key, value: record[key] }))
    .filter((row) => row.value !== null && row.value !== undefined);

  if (rows.length === 0) {
    return "";
  }

  const header = `| Nutrient | ${valueHeader} |`;
  const divider = `| --- | --- |`;
  const body = rows.map((row) => `| ${nutrientLabel(row.key)} | ${formatValue(row.value)} |`);

  return [header, divider, ...body].join("\n");
}

/**
 * Render an arbitrary flat record as a two-column key/value markdown table.
 * Optional `labels` overrides display names; `order` fixes row order.
 */
export function keyValueTable(
  values: Record<string, unknown>,
  options?: { labels?: Record<string, string>; order?: readonly string[]; keyHeader?: string; valueHeader?: string },
): string {
  const labels = options?.labels ?? {};
  const keyHeader = options?.keyHeader ?? "Field";
  const valueHeader = options?.valueHeader ?? "Value";
  const orderedKeys = options?.order
    ? [
        ...options.order.filter((key) => key in values),
        ...Object.keys(values).filter((key) => !options.order!.includes(key)),
      ]
    : Object.keys(values);

  const rows = orderedKeys
    .map((key) => ({ key, value: values[key] }))
    .filter((row) => row.value !== null && row.value !== undefined);

  if (rows.length === 0) {
    return "";
  }

  const header = `| ${keyHeader} | ${valueHeader} |`;
  const divider = `| --- | --- |`;
  const body = rows.map((row) => `| ${labels[row.key] ?? row.key} | ${formatValue(row.value)} |`);

  return [header, divider, ...body].join("\n");
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => formatValue(entry)).join(", ");
  }

  return JSON.stringify(value);
}
