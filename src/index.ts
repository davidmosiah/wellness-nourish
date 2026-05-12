#!/usr/bin/env node

import http from "node:http";

import cors from "cors";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import { registerNourishChatGptApp } from "./apps/nourish-chatgpt-app.js";
import { isCliCommand, isUnknownCliCommand, runCliCommand } from "./cli/commands.js";
import { DEFAULT_HOST, DEFAULT_PORT, SERVER_NAME, SERVER_VERSION } from "./constants.js";
import { registerNourishPrompts } from "./prompts/nourish-prompts.js";
import { registerNourishResources } from "./resources/nourish-resources.js";
import { registerNourishTools } from "./tools/nourish-tools.js";

export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      instructions: serverInstructions(),
    },
  );

  registerNourishTools(server);
  registerNourishChatGptApp(server);
  registerNourishResources(server);
  registerNourishPrompts(server);

  return server;
}

function serverInstructions(): string {
  return [
    "Nourish MCP is a local-first nutrition server for agents and humans.",
    "Start with nourish_agent_manifest, nourish_capabilities, or nourish_connection_status when you need the tool contract or runtime readiness.",
    "For meal text, call nourish_estimate_meal with text or meal_text. Preserve confidence, warnings, and unresolved items; ask one concise clarification when unresolved is not empty.",
    "For Portuguese/Brazilian meals, pass locale pt-BR and do not silently replace unknown food terms with unrelated English defaults.",
    "Only log intake, water, goals, or clear-day after explicit user save intent. Then pass explicit_user_intent: true; otherwise these tools return USER_ACTION_REQUIRED.",
    "For photos, the agent must describe visible foods/portions and call nourish_estimate_meal_photo, then ask for confirmation before logging.",
    "For Telegram food images with barcode, label OCR, or meal observations, call nourish_analyze_food_image to route safely without logging.",
    "For 'what should I eat' questions, use nourish_daily_coach or nourish_suggest_next_meal with optional wearable_context from WHOOP/Garmin/Oura/Eight Sleep tools.",
    "For recurring meals, use nourish_remember_meal only after explicit user intent; future estimates can expand saved labels locally.",
    "This is not medical advice and local storage may contain personal nutrition data.",
  ].join(" ");
}

function helpText(): string {
  return [
    "Usage: nourish-mcp [--http] [--help] [--version]",
    "       nourish-mcp <command> [args]",
    "",
    "Starts the Nourish MCP server over stdio by default.",
    "",
    "Options:",
    "  --http     Start Streamable HTTP transport at POST /mcp.",
    "  --help     Print this usage text without starting the server.",
    "  --version  Print the package name and version.",
    "",
    "Commands:",
    "  status                         Print connection status.",
    "  doctor                         Run local DX checks.",
    "  setup --client <name>           Print MCP config; writes Hermes config/skill for --client hermes.",
    "  search <query>                 Search USDA foods.",
    "  barcode <barcode>              Lookup an Open Food Facts barcode.",
    "  log [--preview] <text...>       Estimate or log a meal.",
    "  list [date]                    List intake entries.",
    "  edit --entry <id> [flags]       Edit intake metadata.",
    "  today [--format markdown]       Print today's intake summary.",
    "  weekly [--format markdown]      Print seven-day intake summary.",
    "  export [--format csv|jsonl]     Export intake data.",
    "  water <ml>|today                Log or summarize hydration.",
    "  goals [--set-calories n]        Show or update local goals.",
    "  clear-day <date> --yes          Delete all intake entries for a day.",
    "  delete --entry <id>             Delete an intake entry.",
  ].join("\n");
}

async function startStdio(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
}

async function startHttp(): Promise<void> {
  const host = process.env.NOURISH_MCP_HOST ?? DEFAULT_HOST;
  const port = parsePort(process.env.NOURISH_MCP_PORT);
  const allowedOrigin = process.env.NOURISH_MCP_ALLOWED_ORIGIN ?? `http://${host}:${port}`;
  const app = express();

  app.use(
    cors({
      origin: allowedOrigin,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      name: SERVER_NAME,
      version: SERVER_VERSION,
    });
  });

  app.post("/mcp", async (req, res) => {
    const server = createServer();
    const transportOptions = {
      enableJsonResponse: true,
      sessionIdGenerator: undefined,
    } as unknown as ConstructorParameters<typeof StreamableHTTPServerTransport>[0];
    const transport = new StreamableHTTPServerTransport(transportOptions);

    let closed = false;
    const close = async () => {
      if (closed) {
        return;
      }

      closed = true;
      // Swallow close errors so they don't surface as unhandledRejection
      // (and crash the process under newer Node defaults). We've already
      // sent the response by this point.
      try {
        await transport.close();
      } catch {
        // ignore — transport may already be closed
      }
      try {
        await server.close();
      } catch {
        // ignore — server may already be closed
      }
    };

    res.on("close", () => {
      void close();
    });

    try {
      await server.connect(transport as unknown as Transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : "Internal server error",
          },
          id: null,
        });
      }

      await close();
    }
  });

  const httpServer = http.createServer(app);

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, host, () => {
      httpServer.off("error", reject);
      resolve();
    });
  });

  process.on("SIGTERM", () => {
    httpServer.close(() => process.exit(0));
  });
  process.on("SIGINT", () => {
    httpServer.close(() => process.exit(0));
  });
}

function parsePort(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_PORT;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PORT;
}

const args = process.argv.slice(2);

if (args.includes("--version")) {
  console.log(`${SERVER_NAME} ${SERVER_VERSION}`);
} else if (args.includes("--help") || args.includes("-h")) {
  console.log(helpText());
} else if (isCliCommand(args)) {
  process.exitCode = await runCliCommand(args);
} else if (isUnknownCliCommand(args)) {
  console.error("Unknown command");
  process.exitCode = 1;
} else if (args.includes("--http") || process.env.NOURISH_MCP_TRANSPORT === "http") {
  await startHttp();
} else {
  await startStdio();
}
