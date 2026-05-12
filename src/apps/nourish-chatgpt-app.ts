import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";

import { buildNutritionCoach } from "../services/coach.js";
import { makeError, makeResponse } from "../services/format.js";
import { getGoals } from "../services/goals-store.js";
import { localDate } from "../services/local-date.js";
import { getPersonalNutritionMemory } from "../services/personal-memory.js";
import {
  buildProfileSummary,
  getProfile,
  missingCriticalFields,
} from "../services/profile-store.js";
import { buildDailySummary } from "../services/summary.js";

const NOURISH_DASHBOARD_URI = "ui://widget/nourish-dashboard-v1.html";

const ChatGptDashboardInputSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Local date to summarize as YYYY-MM-DD. Defaults to today."),
  locale: z.enum(["en", "pt-BR"]).default("en"),
  focus: z.enum(["balanced", "protein", "calories", "hydration", "training"]).optional(),
  response_format: z.enum(["json", "markdown"]).default("json"),
});

export function registerNourishChatGptApp(server: McpServer): void {
  registerAppResource(
    server,
    "nourish-dashboard",
    NOURISH_DASHBOARD_URI,
    {
      description: "Interactive Nourish dashboard for ChatGPT and MCP Apps hosts.",
      _meta: {
        ui: {
          prefersBorder: true,
          csp: {
            connectDomains: [],
            resourceDomains: [],
          },
        },
      },
    },
    async () => ({
      contents: [
        {
          uri: NOURISH_DASHBOARD_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: dashboardHtml(),
          _meta: {
            ui: {
              prefersBorder: true,
              csp: {
                connectDomains: [],
                resourceDomains: [],
              },
            },
          },
        },
      ],
    }),
  );

  registerAppTool(
    server,
    "nourish_chatgpt_dashboard",
    {
      title: "Open Nourish dashboard",
      description:
        "Open an interactive ChatGPT/MCP Apps dashboard for today's nutrition summary, safe meal estimation, and next-meal coaching. Read-only; logging still requires explicit user confirmation through existing tools.",
      inputSchema: ChatGptDashboardInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: {
          resourceUri: NOURISH_DASHBOARD_URI,
          visibility: ["model", "app"],
        },
        "openai/outputTemplate": NOURISH_DASHBOARD_URI,
        "openai/toolInvocation/invoking": "Opening Nourish dashboard",
        "openai/toolInvocation/invoked": "Nourish dashboard ready",
      },
    },
    async (input) => {
      try {
        const params = ChatGptDashboardInputSchema.parse(input);
        const date = params.date ?? localDate();
        const [summary, coach, goals, profile, memory] = await Promise.all([
          buildDailySummary(date),
          buildNutritionCoach({
            mode: "daily_coach",
            date,
            locale: params.locale,
            focus: params.focus,
          }),
          getGoals(),
          getProfile(),
          getPersonalNutritionMemory(),
        ]);
        const payload = {
          ok: true,
          app: {
            name: "Nourish ChatGPT App",
            version: "v1",
            resource_uri: NOURISH_DASHBOARD_URI,
          },
          date,
          locale: params.locale,
          summary: {
            entry_count: summary.entry_count,
            total_nutrients: {
              calories_kcal: summary.total_nutrients.calories_kcal ?? 0,
              protein_g: summary.total_nutrients.protein_g ?? 0,
              carbohydrates_g: summary.total_nutrients.carbohydrates_g ?? 0,
              fat_g: summary.total_nutrients.fat_g ?? 0,
              fiber_g: summary.total_nutrients.fiber_g ?? 0,
            },
            hydration: {
              total_ml: summary.hydration.total_ml,
              goal_ml: summary.hydration.goal_ml,
              progress_percent: summary.hydration.progress_percent,
            },
            goal_progress: summary.goal_progress,
            confidence: summary.confidence,
            source_coverage: summary.source_coverage,
            by_meal: summary.by_meal,
          },
          goals,
          profile: {
            summary: buildProfileSummary(profile),
            missing_critical: missingCriticalFields(profile),
          },
          memory: {
            remembered_meal_count: memory.remembered_meals.length,
          },
          coach: {
            focus: coach.focus,
            gaps: coach.gaps,
            suggested_next_meal: coach.suggested_next_meal,
            next_actions: coach.next_actions,
            warnings: coach.warnings,
            requires_confirmation_to_log: coach.requires_confirmation_to_log,
          },
          quick_actions: [
            {
              label: "Estimate a meal",
              tool: "nourish_estimate_meal",
              read_only: true,
            },
            {
              label: "Review today",
              tool: "nourish_daily_summary",
              read_only: true,
            },
            {
              label: "Log intake",
              tool: "nourish_log_intake",
              requires_explicit_user_intent: true,
            },
          ],
          privacy: {
            local_first: true,
            writes_disabled_in_widget: true,
            note: "This widget estimates and previews only. Persisting intake still requires explicit user confirmation.",
          },
        };
        const markdown = [
          "# Nourish dashboard",
          "",
          `- date: ${date}`,
          `- calories: ${payload.summary.total_nutrients.calories_kcal}`,
          `- protein_g: ${payload.summary.total_nutrients.protein_g}`,
          `- hydration_ml: ${payload.summary.hydration.total_ml}`,
          `- next_meal: ${payload.coach.suggested_next_meal.text}`,
        ].join("\n");

        return toolResponse(makeResponse(payload, params.response_format, markdown));
      } catch (error) {
        return toolResponse(
          makeError(
            "NOURISH_CHATGPT_APP_ERROR",
            error instanceof Error ? error.message : "Unknown dashboard error.",
          ),
        );
      }
    },
  );
}

function toolResponse(response: ReturnType<typeof makeResponse>): CallToolResult {
  return response as unknown as CallToolResult;
}

function dashboardHtml(): string {
  return String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nourish</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #f7faf9;
      --panel: #ffffff;
      --panel-2: #eef6f2;
      --text: #17211d;
      --muted: #68746f;
      --border: #d8e2de;
      --green: #0f8f65;
      --blue: #2563eb;
      --amber: #b7791f;
      --danger: #b42318;
      --shadow: 0 16px 40px rgba(18, 35, 28, 0.1);
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #111816;
        --panel: #17221f;
        --panel-2: #1d2d28;
        --text: #edf7f2;
        --muted: #a6b8b0;
        --border: #2f463f;
        --shadow: 0 16px 42px rgba(0, 0, 0, 0.26);
      }
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-size: 14px;
      line-height: 1.45;
    }
    button, input, select { font: inherit; }
    .shell {
      max-width: 860px;
      margin: 0 auto;
      padding: 18px;
    }
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 14px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .mark {
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      border-radius: 8px;
      color: #fff;
      background: linear-gradient(135deg, var(--green), var(--blue));
      font-weight: 800;
      letter-spacing: 0;
    }
    h1 {
      margin: 0;
      font-size: 18px;
      line-height: 1.2;
      font-weight: 720;
      letter-spacing: 0;
    }
    .date {
      color: var(--muted);
      font-size: 12px;
      margin-top: 2px;
    }
    .status {
      white-space: nowrap;
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 6px 10px;
      color: var(--muted);
      background: var(--panel);
      font-size: 12px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 14px;
    }
    .panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      box-shadow: var(--shadow);
      padding: 14px;
      min-width: 0;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
      margin-top: 12px;
    }
    .metric {
      background: var(--panel-2);
      border-radius: 8px;
      padding: 10px;
      min-height: 74px;
    }
    .metric strong {
      display: block;
      font-size: 20px;
      line-height: 1.1;
      margin-bottom: 6px;
    }
    .metric span, .label, .small {
      color: var(--muted);
      font-size: 12px;
    }
    .bars {
      display: grid;
      gap: 10px;
      margin-top: 12px;
    }
    .bar-row {
      display: grid;
      grid-template-columns: 86px minmax(0, 1fr) 44px;
      align-items: center;
      gap: 8px;
    }
    .bar-track {
      height: 8px;
      background: var(--panel-2);
      border-radius: 999px;
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      width: 0%;
      background: var(--green);
      border-radius: inherit;
    }
    .next {
      border-left: 4px solid var(--green);
      padding-left: 12px;
    }
    .next h2, .panel h2 {
      margin: 0 0 8px;
      font-size: 14px;
      line-height: 1.2;
      font-weight: 720;
    }
    .meal {
      margin: 0;
      font-size: 16px;
      font-weight: 680;
    }
    .reason {
      color: var(--muted);
      margin: 8px 0 0;
    }
    .actions {
      display: grid;
      gap: 8px;
      margin-top: 12px;
    }
    .action {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 9px 10px;
      background: transparent;
      text-align: left;
    }
    .estimate {
      display: grid;
      gap: 8px;
      margin-top: 12px;
    }
    .estimate-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
    }
    input {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 11px;
      background: var(--panel);
      color: var(--text);
    }
    button {
      border: 0;
      border-radius: 8px;
      padding: 10px 12px;
      background: var(--text);
      color: var(--panel);
      cursor: pointer;
      font-weight: 650;
    }
    button:disabled {
      opacity: 0.55;
      cursor: wait;
    }
    .estimate-result {
      min-height: 48px;
      border: 1px dashed var(--border);
      border-radius: 8px;
      padding: 10px;
      color: var(--muted);
      background: color-mix(in srgb, var(--panel-2), transparent 40%);
    }
    .warning {
      color: var(--amber);
      margin-top: 8px;
    }
    .error { color: var(--danger); }

    @media (max-width: 720px) {
      .shell { padding: 12px; }
      .topbar { align-items: flex-start; }
      .grid { grid-template-columns: 1fr; }
      .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .bar-row { grid-template-columns: 78px minmax(0, 1fr) 42px; }
      .status { white-space: normal; text-align: right; }
    }
  </style>
</head>
<body>
  <main class="shell" id="nourish-app-root">
    <div class="topbar">
      <div class="brand">
        <div class="mark" aria-hidden="true">N</div>
        <div>
          <h1>Nourish</h1>
          <div class="date" id="date">Waiting for ChatGPT...</div>
        </div>
      </div>
      <div class="status" id="status">Preview only</div>
    </div>
    <div class="grid">
      <section class="panel">
        <h2>Today</h2>
        <div class="metrics" id="metrics"></div>
        <div class="bars" id="bars"></div>
      </section>
      <section class="panel next">
        <h2>Next meal</h2>
        <p class="meal" id="next-meal">No suggestion yet</p>
        <p class="reason" id="next-reason"></p>
        <div class="actions" id="actions"></div>
      </section>
      <section class="panel">
        <h2>Estimate</h2>
        <form class="estimate" id="estimate-form">
          <div class="estimate-row">
            <input id="meal-input" autocomplete="off" placeholder="2 eggs, banana, black coffee">
            <button id="estimate-button" type="submit">Estimate</button>
          </div>
          <div class="estimate-result" id="estimate-result">Meal estimates stay in preview until you ask to log them.</div>
        </form>
      </section>
      <section class="panel">
        <h2>Profile</h2>
        <div id="profile-summary" class="small">No profile loaded yet</div>
        <div id="warnings"></div>
      </section>
    </div>
  </main>
  <script>
    const state = {
      dashboard: null,
      pending: new Map(),
      nextId: 1,
      connected: false,
      host: null
    };

    function number(value, suffix = "") {
      const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
      return String(Math.round(safe)) + suffix;
    }

    function percent(value) {
      const safe = Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : 0;
      return String(Math.round(safe));
    }

    function setStatus(text) {
      document.getElementById("status").textContent = text;
    }

    function render(data) {
      state.dashboard = data;
      document.getElementById("date").textContent = data.date || "Today";
      setStatus(data.privacy?.writes_disabled_in_widget ? "Preview only" : "Connected");

      const totals = data.summary?.total_nutrients || {};
      const hydration = data.summary?.hydration || {};
      document.getElementById("metrics").innerHTML = [
        metric("Calories", number(totals.calories_kcal)),
        metric("Protein", number(totals.protein_g, "g")),
        metric("Fiber", number(totals.fiber_g, "g")),
        metric("Water", number(hydration.total_ml, "ml"))
      ].join("");

      const progress = data.summary?.goal_progress || {};
      document.getElementById("bars").innerHTML = [
        bar("Calories", progress.calories_kcal?.percent),
        bar("Protein", progress.protein_g?.percent),
        bar("Hydration", hydration.progress_percent ?? progress.hydration_ml?.percent)
      ].filter(Boolean).join("") || '<div class="small">Set goals to see progress bars.</div>';

      const suggestion = data.coach?.suggested_next_meal || {};
      document.getElementById("next-meal").textContent = suggestion.text || "No suggestion yet";
      document.getElementById("next-reason").textContent = suggestion.reason || "";
      document.getElementById("actions").innerHTML = (data.coach?.next_actions || [])
        .slice(0, 3)
        .map((item) => '<div class="action">' + escapeHtml(item) + '</div>')
        .join("");

      document.getElementById("profile-summary").textContent = data.profile?.summary || "Empty profile";
      const warnings = [
        ...(data.profile?.missing_critical || []).map((item) => "Missing profile: " + item),
        ...(data.coach?.warnings || [])
      ].slice(0, 4);
      document.getElementById("warnings").innerHTML = warnings
        .map((item) => '<div class="warning">' + escapeHtml(item) + '</div>')
        .join("");
    }

    function metric(label, value) {
      return '<div class="metric"><strong>' + escapeHtml(value) + '</strong><span>' + escapeHtml(label) + '</span></div>';
    }

    function bar(label, value) {
      if (value === undefined || value === null) return "";
      const width = percent(value);
      return '<div class="bar-row"><span class="label">' + escapeHtml(label) + '</span><div class="bar-track"><div class="bar-fill" style="width:' + width + '%"></div></div><span class="small">' + width + '%</span></div>';
    }

    function sendMessage(message) {
      window.parent.postMessage(message, "*");
    }

    function sendNotification(method, params = {}) {
      sendMessage({
        jsonrpc: "2.0",
        method,
        params
      });
    }

    function sendRequest(method, params = {}, timeoutMs = 20000) {
      const id = state.nextId++;
      const message = {
        jsonrpc: "2.0",
        id,
        method,
        params
      };
      sendMessage(message);
      return new Promise((resolve, reject) => {
        state.pending.set(id, { resolve, reject });
        setTimeout(() => {
          if (!state.pending.has(id)) return;
          state.pending.delete(id);
          reject(new Error("Tool call timed out."));
        }, timeoutMs);
      });
    }

    function callTool(name, args) {
      return sendRequest("tools/call", { name, arguments: args });
    }

    function handleMessage(event) {
      if (event.source !== window.parent) return;
      const message = event.data;
      if (!message || message.jsonrpc !== "2.0") return;

      if (message.id !== undefined && state.pending.has(message.id)) {
        const pending = state.pending.get(message.id);
        state.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message || "Tool call failed."));
        else pending.resolve(message.result);
        return;
      }

      if (message.method === "ui/notifications/tool-result") {
        const data = message.params?.structuredContent || parseToolText(message.params);
        if (data?.ok) render(data);
      }
    }

    async function connectApp() {
      setStatus("Connecting");
      try {
        state.host = await sendRequest("ui/initialize", {
          appInfo: { name: "Nourish", version: "1.0.0" },
          appCapabilities: {
            tools: { listChanged: true },
            availableDisplayModes: ["inline", "fullscreen"]
          },
          protocolVersion: "2026-01-26"
        }, 5000);
        state.connected = true;
        sendNotification("ui/notifications/initialized");
        sendSizeChanged();
        setStatus("Preview only");
      } catch {
        setStatus("Waiting for host");
      }
    }

    function sendSizeChanged() {
      const width = Math.ceil(document.documentElement.getBoundingClientRect().width);
      const height = Math.ceil(document.documentElement.getBoundingClientRect().height);
      sendNotification("ui/notifications/size-changed", { width, height });
    }

    async function submitEstimate(event) {
      event.preventDefault();
      const input = document.getElementById("meal-input");
      const button = document.getElementById("estimate-button");
      const result = document.getElementById("estimate-result");
      const text = input.value.trim();
      if (!text) return;
      button.disabled = true;
      result.textContent = "Estimating...";
      try {
        const response = await callTool("nourish_estimate_meal", {
          text,
          response_format: "json",
          locale: state.dashboard?.locale || "en"
        });
        const estimate = response?.structuredContent || parseToolText(response);
        const totals = estimate?.total_nutrients || {};
        result.innerHTML = [
          '<strong>' + escapeHtml(number(totals.calories_kcal)) + ' kcal</strong>',
          '<span class="small"> protein ' + escapeHtml(number(totals.protein_g, "g")) + ' - confidence ' + escapeHtml(String(estimate?.confidence ?? "unknown")) + '</span>',
          estimate?.unresolved?.length ? '<div class="warning">Unresolved: ' + escapeHtml(estimate.unresolved.join(", ")) + '</div>' : ''
        ].join("<br>");
      } catch (error) {
        result.innerHTML = '<span class="error">' + escapeHtml(error.message || "Estimate failed.") + '</span>';
      } finally {
        button.disabled = false;
      }
    }

    function parseToolText(response) {
      const text = (response?.content || [])
        .filter((entry) => entry.type === "text")
        .map((entry) => entry.text)
        .join("\\n");
      try { return JSON.parse(text); } catch { return null; }
    }

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    window.addEventListener("message", handleMessage, { passive: true });
    document.getElementById("estimate-form").addEventListener("submit", submitEstimate);
    window.addEventListener("resize", sendSizeChanged, { passive: true });
    connectApp();
  </script>
</body>
</html>`;
}
