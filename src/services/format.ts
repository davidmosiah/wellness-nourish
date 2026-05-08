import type { ResponseFormat } from "../types.js";

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
