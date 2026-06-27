import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import sharp from "sharp";

const checkMode = process.argv.includes("--check");
const noBuild = process.argv.includes("--no-build");
const transcriptPath = resolve("docs/telegram-demo-transcript.json");
const assetPath = resolve("assets/telegram-hermes-nourish-demo.webp");
const width = 1280;
const height = 860;

if (!noBuild) {
  execFileSync("npm", ["run", "build"], { stdio: "inherit" });
}

const transcript = await buildTranscript();
assertNoSecretLikeText(JSON.stringify(transcript));

if (checkMode) {
  assert.equal(existsSync(transcriptPath), true, `${transcriptPath} must exist`);
  assert.equal(existsSync(assetPath), true, `${assetPath} must exist`);
  assert.equal(
    readFileSync(transcriptPath, "utf8"),
    stableJson(transcript),
    "docs/telegram-demo-transcript.json is stale; run npm run demo:capture",
  );

  const metadata = await sharp(assetPath).metadata();
  assert.equal(metadata.format, "webp", "telegram demo capture must be a WebP image");
  assert.equal(metadata.width, width, "telegram demo capture width drifted");
  assert.equal(metadata.height, height, "telegram demo capture height drifted");
  assert.ok(readFileSync(assetPath).byteLength < 350_000, "telegram demo capture should stay compact");

  const readme = readFileSync(resolve("README.md"), "utf8");
  const telegramDoc = readFileSync(resolve("docs/telegram.md"), "utf8");
  assert.match(readme, /assets\/telegram-hermes-nourish-demo\.webp/);
  assert.match(telegramDoc, /telegram-demo-transcript\.json/);
  console.log("telegram demo capture check ok");
} else {
  const webp = await renderCaptureWebp(transcript);
  writeFileSync(transcriptPath, stableJson(transcript));
  writeFileSync(assetPath, webp);
  console.log(`wrote ${transcriptPath}`);
  console.log(`wrote ${assetPath}`);
}

async function buildTranscript() {
  const localDir = mkdtempSync(`${tmpdir()}/nourish-telegram-demo-`);
  const fixtureDir = resolve("fixtures");
  const client = new Client(
    {
      name: "nourish-telegram-demo-capture",
      version: "0.1.0",
    },
    {
      capabilities: {},
    },
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["dist/index.js"],
    cwd: process.cwd(),
    stderr: "pipe",
    env: {
      ...process.env,
      NOURISH_FIXTURE_MODE: "1",
      NOURISH_FIXTURE_DIR: fixtureDir,
      NOURISH_LOCAL_DIR: localDir,
      NOURISH_TIMEZONE: "UTC",
    },
  });

  try {
    await client.connect(transport);
    const mealText = "1 prato de arroz branco, 1 concha de feijao carioca, 150g frango grelhado e salada verde";
    const estimate = await callTool(client, "nourish_estimate_meal", {
      meal_text: mealText,
      meal_type: "lunch",
      locale: "pt-BR",
      response_format: "json",
    });

    assert.ok((estimate.total_nutrients?.calories_kcal ?? 0) > 450, "estimate should include calories");
    assert.ok((estimate.total_nutrients?.protein_g ?? 0) > 25, "estimate should include protein");

    const log = await callTool(client, "nourish_log_intake", {
      meal_text: mealText,
      meal_type: "lunch",
      locale: "pt-BR",
      timestamp: "2026-06-27T15:20:00.000Z",
      explicit_user_intent: true,
      tags: ["demo", "telegram-hermes"],
      response_format: "json",
    });

    assert.equal(typeof log.id, "string", "log response should include an intake id");
    assert.equal(log.explicit_user_intent, undefined, "persisted entry should not echo write intent");

    const summary = await callTool(client, "nourish_daily_summary", {
      date: "2026-06-27",
      response_format: "json",
    });

    assert.equal(summary.date, "2026-06-27");
    assert.equal(summary.entry_count, 1);
    assert.ok((summary.total_nutrients?.calories_kcal ?? 0) > 450);

    const estimateTotals = nutrientSnapshot(estimate.total_nutrients);
    const summaryTotals = nutrientSnapshot(summary.total_nutrients);
    const unresolved = Array.isArray(estimate.unresolved) ? estimate.unresolved : [];

    return {
      kind: "telegram_hermes_nourish_demo_capture",
      version: 1,
      generated_by: "scripts/generate-telegram-demo-capture.mjs",
      deterministic_demo_date: "2026-06-27",
      privacy: {
        fixture_mode: true,
        local_storage: "temporary demo directory",
        no_real_messenger_secret: true,
        no_telegram_chat_identifier: true,
        no_personal_food_log: true,
      },
      acceptance: {
        shows_estimate_first: true,
        shows_confirmation_second: true,
        shows_saved_daily_summary_third: true,
        requires_explicit_user_intent_for_write: true,
      },
      conversation: [
        {
          step: 1,
          actor: "telegram_user",
          message: "Almoco: arroz, feijao, frango grelhado e salada. Pode estimar?",
        },
        {
          step: 2,
          actor: "hermes",
          tool: "nourish_estimate_meal",
          result: {
            calories_kcal: estimateTotals.calories_kcal,
            protein_g: estimateTotals.protein_g,
            confidence: round(estimate.confidence, 2),
            unresolved,
          },
          reply: `Estimativa: ${estimateTotals.calories_kcal} kcal, ${estimateTotals.protein_g}g proteina, confianca ${round(estimate.confidence, 2)}. Quer salvar?`,
        },
        {
          step: 3,
          actor: "telegram_user",
          message: "Sim, pode salvar esse almoco.",
        },
        {
          step: 4,
          actor: "hermes",
          tool: "nourish_log_intake",
          tool_args: {
            explicit_user_intent: true,
            meal_type: "lunch",
            tags: ["demo", "telegram-hermes"],
          },
          result: {
            saved: true,
            intake_id_present: true,
            calories_kcal: round(log.nutrients?.calories_kcal, 0),
            protein_g: round(log.nutrients?.protein_g, 1),
          },
        },
        {
          step: 5,
          actor: "hermes",
          tool: "nourish_daily_summary",
          result: {
            date: summary.date,
            entries: summary.entry_count,
            calories_kcal: summaryTotals.calories_kcal,
            protein_g: summaryTotals.protein_g,
            confidence: round(summary.confidence, 2),
          },
          reply: `Salvo. Hoje: ${summary.entry_count} entrada, ${summaryTotals.calories_kcal} kcal, ${summaryTotals.protein_g}g proteina.`,
        },
      ],
    };
  } finally {
    await client.close();
    rmSync(localDir, { recursive: true, force: true });
  }
}

async function callTool(client, name, args) {
  const result = await client.callTool({ name, arguments: args });
  assert.notEqual(result.isError, true, `${name} returned an MCP error: ${textFromToolResult(result)}`);
  return JSON.parse(textFromToolResult(result));
}

function textFromToolResult(result) {
  return result.content
    .filter((entry) => entry.type === "text")
    .map((entry) => entry.text)
    .join("\n");
}

function nutrientSnapshot(nutrients) {
  return {
    calories_kcal: round(nutrients?.calories_kcal, 0),
    protein_g: round(nutrients?.protein_g, 1),
    carbohydrates_g: round(nutrients?.carbohydrates_g, 1),
    fat_g: round(nutrients?.fat_g, 1),
  };
}

function round(value, digits) {
  const numeric = Number(value ?? 0);
  const multiplier = 10 ** digits;
  return Math.round(numeric * multiplier) / multiplier;
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function renderCaptureWebp(transcript) {
  const estimate = transcript.conversation[1].result;
  const summary = transcript.conversation[4].result;
  const svg = renderSvg({
    estimate,
    summary,
    userMeal: transcript.conversation[0].message,
    estimateReply: transcript.conversation[1].reply,
    confirmation: transcript.conversation[2].message,
    summaryReply: transcript.conversation[4].reply,
  });
  return sharp(Buffer.from(svg)).webp({ quality: 88, effort: 6 }).toBuffer();
}

function renderSvg(model) {
  const left = 70;
  const top = 64;
  const phoneWidth = 560;
  const phoneHeight = 720;
  const panelX = 690;
  const panelY = 124;
  const panelWidth = 520;

  const userMealLines = wrap(model.userMeal, 42);
  const estimateLines = wrap(model.estimateReply, 45);
  const confirmationLines = wrap(model.confirmation, 38);
  const summaryLines = wrap(model.summaryReply, 45);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">Wellness Nourish Telegram and Hermes demo capture</title>
  <desc id="desc">A sanitized Telegram style capture generated from real Wellness Nourish MCP tool calls: estimate, confirm, log and daily summary.</desc>
  <rect width="1280" height="860" fill="#07111f"/>
  <rect x="0" y="0" width="1280" height="860" fill="#0f172a"/>
  <rect x="32" y="34" width="1216" height="792" rx="28" fill="#0b1220" stroke="#1f2a44" stroke-width="2"/>

  <text x="70" y="66" fill="#e5f4ff" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="30" font-weight="800">Telegram -> Hermes -> Wellness Nourish</text>
  <text x="70" y="96" fill="#8fb3c7" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="15">Real MCP transcript, fixture mode, temporary local directory, no tokens or private logs</text>

  <rect x="${left}" y="${top + 58}" width="${phoneWidth}" height="${phoneHeight}" rx="38" fill="#101b2e" stroke="#2c3f5f" stroke-width="2"/>
  <rect x="${left + 24}" y="${top + 86}" width="${phoneWidth - 48}" height="${phoneHeight - 56}" rx="24" fill="#e5eef6"/>
  <rect x="${left + 24}" y="${top + 86}" width="${phoneWidth - 48}" height="62" rx="24" fill="#229ed9"/>
  <text x="${left + 54}" y="${top + 125}" fill="#ffffff" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="20" font-weight="800">Hermes Nourish</text>
  <text x="${left + 444}" y="${top + 125}" fill="#d7f5ff" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="13">demo</text>

  ${bubble({ x: left + 260, y: top + 178, w: 282, lines: userMealLines, fill: "#d9fdd3", align: "right" })}
  ${bubble({ x: left + 46, y: top + 296, w: 420, lines: estimateLines, fill: "#ffffff", align: "left", label: "nourish_estimate_meal" })}
  ${bubble({ x: left + 290, y: top + 440, w: 252, lines: confirmationLines, fill: "#d9fdd3", align: "right" })}
  ${bubble({ x: left + 46, y: top + 548, w: 420, lines: summaryLines, fill: "#ffffff", align: "left", label: "nourish_log_intake + summary" })}

  <rect x="${panelX}" y="${panelY}" width="${panelWidth}" height="660" rx="20" fill="#111c2f" stroke="#2d415f" stroke-width="2"/>
  <text x="${panelX + 28}" y="${panelY + 44}" fill="#ecfeff" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="22" font-weight="800">Tool trace from real run</text>
  <text x="${panelX + 28}" y="${panelY + 70}" fill="#94a3b8" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="14">Generated by scripts/generate-telegram-demo-capture.mjs</text>

  ${traceCard(panelX + 28, panelY + 104, "1. Estimate first", "nourish_estimate_meal", [
    `${model.estimate.calories_kcal} kcal`,
    `${model.estimate.protein_g}g protein`,
    `confidence ${model.estimate.confidence}`,
  ])}
  ${traceCard(panelX + 28, panelY + 282, "2. Confirmation gates write", "user confirms before explicit_user_intent=true", [
    "no write from estimate",
    "no token or chat id",
    "temp demo local dir",
  ])}
  ${traceCard(panelX + 28, panelY + 460, "3. Saved daily summary", "nourish_log_intake -> nourish_daily_summary", [
    `${model.summary.entries} entry saved`,
    `${model.summary.calories_kcal} kcal today`,
    `${model.summary.protein_g}g protein today`,
  ])}

  <rect x="${panelX + 28}" y="${panelY + 608}" width="${panelWidth - 56}" height="30" rx="15" fill="#0f2e23" stroke="#1f7a4d"/>
  <text x="${panelX + 48}" y="${panelY + 628}" fill="#bbf7d0" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="13" font-weight="700">Safe demo: fixture mode, synthetic meal, no private health or food data</text>
</svg>`;
}

function bubble({ x, y, w, lines, fill, align, label }) {
  const lineHeight = 20;
  const labelHeight = label === undefined ? 0 : 20;
  const h = 24 + labelHeight + lines.length * lineHeight;
  const textAnchor = align === "right" ? "end" : "start";
  const textX = align === "right" ? x + w - 18 : x + 18;
  const labelMarkup = label === undefined
    ? ""
    : `<text x="${textX}" y="${y + 27}" text-anchor="${textAnchor}" fill="#64748b" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="12" font-weight="700">${escapeXml(label)}</text>`;
  const firstLineY = y + 24 + labelHeight;
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${fill}" stroke="#d7e2ec"/>
  ${labelMarkup}
  ${lines.map((line, index) => `<text x="${textX}" y="${firstLineY + index * lineHeight}" text-anchor="${textAnchor}" fill="#0f172a" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="14">${escapeXml(line)}</text>`).join("\n  ")}`;
}

function traceCard(x, y, title, tool, facts) {
  return `
  <rect x="${x}" y="${y}" width="464" height="144" rx="16" fill="#16243a" stroke="#334155"/>
  <text x="${x + 20}" y="${y + 34}" fill="#f8fafc" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="18" font-weight="800">${escapeXml(title)}</text>
  <text x="${x + 20}" y="${y + 59}" fill="#67e8f9" font-family="Menlo, Consolas, monospace" font-size="13">${escapeXml(tool)}</text>
  ${facts.map((fact, index) => `<text x="${x + 24}" y="${y + 88 + index * 20}" fill="#cbd5e1" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="14">- ${escapeXml(fact)}</text>`).join("\n  ")}`;
}

function wrap(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (candidate.length > maxChars && current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function assertNoSecretLikeText(text) {
  const patterns = [
    /bot[0-9]+:[A-Za-z0-9_-]{20,}/,
    /sk-[A-Za-z0-9_-]{20,}/,
    /sk-proj-[A-Za-z0-9_-]{20,}/,
    /github_pat_[A-Za-z0-9_]+/,
    /xox[baprs]-[A-Za-z0-9-]+/,
    /"chat_id"\s*:/i,
    /telegram_token/i,
    /Authorization:/i,
    /Bearer\s+[A-Za-z0-9._-]+/i,
  ];
  for (const pattern of patterns) {
    assert.doesNotMatch(text, pattern, `demo capture contains secret-like text: ${pattern}`);
  }
}
