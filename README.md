[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/davidmosiah-wellness-nourish-badge.png)](https://mseep.ai/app/davidmosiah-wellness-nourish)

<!-- delx-wellness header v2 -->
<h1 align="center">Wellness Nourish</h1>

<div align="center">
  <img src="assets/banner.png" alt="Wellness Nourish — Nourish MCP for AI agents" width="85%" />
</div>

<h3 align="center">
  Local-first nutrition MCP &mdash; food search, barcode lookup, intake logging, hydration. Works without OAuth.<br>
  Local-first MCP server &mdash; <strong>tokens never leave your machine</strong>.
</h3>

<p align="center">
  <a href="https://www.npmjs.com/package/wellness-nourish"><img src="https://img.shields.io/npm/v/wellness-nourish?style=for-the-badge&labelColor=0F172A&color=10B981&logo=npm&logoColor=white" alt="npm version" /></a>
  <a href="https://github.com/davidmosiah/wellness-nourish/releases/latest"><img src="https://img.shields.io/github/v/release/davidmosiah/wellness-nourish?style=for-the-badge&labelColor=0F172A&color=2563EB&logo=github" alt="GitHub release" /></a>
  <a href="https://www.npmjs.com/package/wellness-nourish"><img src="https://img.shields.io/npm/dm/wellness-nourish?style=for-the-badge&labelColor=0F172A&color=0EA5A3&logo=npm&logoColor=white" alt="npm downloads" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/LICENSE-MIT-22C55E?style=for-the-badge&labelColor=0F172A" alt="License MIT" /></a>
  <a href="https://wellness.delx.ai/nutrition"><img src="https://img.shields.io/badge/SITE-wellness.delx.ai-0EA5A3?style=for-the-badge&labelColor=0F172A" alt="Site" /></a>
</p>

<p align="center">
  <a href="https://github.com/davidmosiah/wellness-nourish/stargazers"><img src="https://img.shields.io/github/stars/davidmosiah/wellness-nourish?style=for-the-badge&labelColor=0F172A&color=FBBF24&logo=github" alt="GitHub stars" /></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/BUILT_FOR-MCP-7C3AED?style=for-the-badge&labelColor=0F172A" alt="Built for MCP" /></a>
  <a href="https://github.com/davidmosiah/delx-wellness/blob/main/docs/release-index.md"><img src="https://img.shields.io/badge/VERIFIED-release_index-0EA5A3?style=for-the-badge&labelColor=0F172A" alt="Verified release index" /></a>
  <a href="https://github.com/davidmosiah/delx-wellness-hermes"><img src="https://img.shields.io/badge/HERMES-one--command_setup-10B981?style=for-the-badge&labelColor=0F172A" alt="Hermes one-command setup" /></a>
  <a href="https://github.com/davidmosiah/delx-wellness-openclaw"><img src="https://img.shields.io/badge/OPENCLAW-one--command_setup-FB923C?style=for-the-badge&labelColor=0F172A" alt="OpenClaw one-command setup" /></a>
  <a href="https://github.com/davidmosiah/delx-wellness"><img src="https://img.shields.io/badge/Nourish-10B981?style=for-the-badge&labelColor=0F172A&logoColor=white" alt="Nourish" /></a>
</p>

<p align="center">
  <strong>📈 Published on npm and used by AI agents and MCP clients</strong> &mdash; see the live <a href="https://www.npmjs.com/package/wellness-nourish">download badge</a> above for current numbers.<br>
  <sub>If Nourish helps your agent, a ⭐ on this repo makes it easier for other AI builders to find.</sub>
</p>

> ⚡ **One-command install** &mdash; pick your runtime:
> - [Delx Wellness for Hermes](https://github.com/davidmosiah/delx-wellness-hermes): `npx -y delx-wellness-hermes setup`
> - [Delx Wellness for OpenClaw](https://github.com/davidmosiah/delx-wellness-openclaw): `npx -y delx-wellness-openclaw setup`
>
> Both preconfigure this connector and the full Delx Wellness stack into a dedicated profile. Or wire it standalone into Claude Desktop / Cursor / ChatGPT Desktop &mdash; see the install section below.
>
> Want runnable agent examples? Use the [Delx Agent Workbench](https://github.com/davidmosiah/delx-agent-workbench) for prompt packs, MCP client configs and local-first workflow templates.

> **Public proof:** Nourish is tracked in the Delx [Open Source Growth Snapshot](https://github.com/davidmosiah/delx-wellness/blob/main/docs/open-source-growth-snapshot.md) alongside downloads, stars and next-action priorities. If this saves you setup time, star this repo so other agent builders can find the local-first nutrition path faster.

---

<!-- /delx-wellness header v2 -->

Local-first nutrition MCP for AI agents — food search, barcode lookup, photo-assisted meal estimation, intake logging, hydration, goals and coach-style workflows. No OAuth, no hosted account.

## Front door

- **Install one connector** — `npx -y wellness-nourish setup --client claude`
- **Run it in** Claude · Cursor · ChatGPT · Hermes · OpenClaw — see the [client examples](https://github.com/davidmosiah/delx-wellness#run-it-in-your-agent).
- **Local-first** — your tokens and food logs never leave your machine ([privacy](#privacy--what-runs-offline)).
- **Which connector should I use?** — see the [front-door guide](https://github.com/davidmosiah/delx-wellness#which-connector-should-i-use).

## Quickstart (60 seconds)

```bash
npx -y wellness-nourish doctor
npx -y wellness-nourish search banana
npx -y wellness-nourish barcode 0000000000000
npx -y wellness-nourish log --preview "2 ovos, banana e café preto"
```

`doctor` checks readiness, `search`/`barcode` hit the food providers, and `log --preview` estimates a meal locally without writing anything.

### Zero-secret demo (offline, no API key)

`NOURISH_FIXTURE_MODE=1` serves the bundled `fixtures/` instead of calling USDA or Open Food Facts, so you can see the exact shape of every response with zero network access or keys:

```bash
$ NOURISH_FIXTURE_MODE=1 wellness-nourish search banana
Bananas, raw	usda	89 kcal/100g
BANANA	usda	312 kcal/100g
```

## Try it with your agent

Three copy-paste prompts, all backed by existing tools:

- "Estimate the calories and protein in 2 eggs, a banana and black coffee." → `nourish_estimate_meal`
- "Look up the barcode 737628064502 and tell me what it is." → `nourish_lookup_barcode`
- "What should I eat next today, given my goals?" → `nourish_daily_coach` / `nourish_suggest_next_meal`

Mutating tools (log intake, water, goals, clear-day) never run without explicit user save intent — they return `USER_ACTION_REQUIRED` until the agent passes `explicit_user_intent: true`.

## Tools

Nourish exposes food search, barcode lookup (text + image), photo-assisted meal estimation, intake logging, hydration, goals, exports, daily/weekly summaries, personal meal memory, and coach-style workflows over stdio (default) or Streamable HTTP (`POST /mcp`).

- **Full CLI (20+ commands), install, client configs & ChatGPT dashboard** → [`docs/cli.md`](docs/cli.md)
- **Hermes / Telegram personal setup (10-step flow)** → [`docs/telegram.md`](docs/telegram.md)
- **Data providers & attribution (USDA, Open Food Facts, ZXing)** → [`docs/providers.md`](docs/providers.md)
- **pt-BR meal-estimator eval set (52 examples)** → [`docs/evals/pt-br-meal-estimator.json`](docs/evals/pt-br-meal-estimator.json)
- **Reproducible Telegram/Hermes demo transcript** → [`docs/telegram-demo-transcript.json`](docs/telegram-demo-transcript.json)

### Food photo decision tree

Agents should route Telegram/Hermes/OpenClaw food photos by the strongest signal they can extract:

1. Barcode is visible and image bytes are available: call `nourish_lookup_barcode_image`.
2. Barcode is blurry or no product is found: ask for sharper barcode digits, or call `nourish_analyze_food_image` with `barcode_observation` plus any OCR/meal clues.
3. Nutrition facts are readable: OCR the label and call `nourish_analyze_food_image` with `product_name` and `nutrition_label_text`.
4. It is a plate or unpackaged food: describe visible foods/portions and call `nourish_analyze_food_image` with `detected_items` or `image_description`.
5. Never log from an image response until the user confirms the product or meal, serving size and save intent.

Image tools accept exactly one of these input forms:

```json
{ "image_path": "/tmp/telegram-food-photo.jpg" }
```

```json
{ "image_base64": "<base64 image bytes>", "image_mime_type": "image/jpeg" }
```

```json
{ "image_data_uri": "data:image/jpeg;base64,<base64 image bytes>" }
```

If barcode decoding fails, the response includes `fallback` and `next_actions` so the agent can ask the user for the typed digits, OCR the nutrition label, or route the photo as a meal without silently inventing a food.

<p align="center">
  <img src="assets/telegram-hermes-nourish-demo.webp" alt="Wellness Nourish Telegram and Hermes demo capture showing estimate, confirmation, log and daily summary" width="92%" />
</p>

The capture above is generated from a real MCP run in fixture mode with a temporary local directory:

```bash
npm run demo:capture
```

The committed transcript proves the exact tool sequence: `nourish_estimate_meal` → user confirmation → `nourish_log_intake` → `nourish_daily_summary`.

## Privacy & what runs offline

Intake, hydration and goals are stored locally under `~/.wellness-nourish/` (override with `NOURISH_LOCAL_DIR`). The connector does not require hosted accounts and does not send local intake logs to Delx Wellness. Provider lookups may contact USDA FoodData Central or Open Food Facts — unless `NOURISH_FIXTURE_MODE=1` keeps everything offline against the bundled fixtures.

Agents should never ask users to paste API keys, tokens, raw health exports, or private food logs into chat — configure secrets through environment variables or local files. Full detail in [`docs/providers.md`](docs/providers.md).

## See the full agent demo →

Watch Nourish work alongside the other connectors in one reproducible run:

```bash
npx -y delx-living-body demo
```

Anchor question: **"Should I train hard today?"** — the demo combines wearable recovery signals with nutrition context to answer it. This is the shared, reproducible proof for the whole Delx Wellness stack.

<!-- delx-wellness see-also -->

## See also

The full [Delx Wellness](https://wellness.delx.ai) connector library:

| Provider | Package | Repo |
|---|---|---|
| WHOOP | [`whoop-mcp-unofficial`](https://www.npmjs.com/package/whoop-mcp-unofficial) | [whoop-mcp](https://github.com/davidmosiah/whoop-mcp) |
| Oura | [`oura-mcp-unofficial`](https://www.npmjs.com/package/oura-mcp-unofficial) | [ouramcp](https://github.com/davidmosiah/ouramcp) |
| Garmin | [`garmin-mcp-unofficial`](https://www.npmjs.com/package/garmin-mcp-unofficial) | [garmin-mcp](https://github.com/davidmosiah/garmin-mcp) |
| Strava | [`strava-mcp-unofficial`](https://www.npmjs.com/package/strava-mcp-unofficial) | [strava-mcp](https://github.com/davidmosiah/strava-mcp) |
| Fitbit | [`fitbit-mcp-unofficial`](https://www.npmjs.com/package/fitbit-mcp-unofficial) | [fitbitmcp](https://github.com/davidmosiah/fitbitmcp) |
| Google Health | [`google-health-mcp-unofficial`](https://www.npmjs.com/package/google-health-mcp-unofficial) | [google-health-mcp](https://github.com/davidmosiah/google-health-mcp) |
| Withings | [`withings-mcp-unofficial`](https://www.npmjs.com/package/withings-mcp-unofficial) | [withingsmcp](https://github.com/davidmosiah/withingsmcp) |
| Apple Health | [`apple-health-mcp-unofficial`](https://www.npmjs.com/package/apple-health-mcp-unofficial) | [apple-health-mcp](https://github.com/davidmosiah/apple-health-mcp) |
| Samsung Health | [`samsung-health-mcp-unofficial`](https://www.npmjs.com/package/samsung-health-mcp-unofficial) | [samsung-health-mcp](https://github.com/davidmosiah/samsung-health-mcp) |
| Polar | [`polar-mcp-unofficial`](https://www.npmjs.com/package/polar-mcp-unofficial) | [polarmcp](https://github.com/davidmosiah/polarmcp) |
| Nourish (nutrition) | [`wellness-nourish`](https://www.npmjs.com/package/wellness-nourish) | [wellness-nourish](https://github.com/davidmosiah/wellness-nourish) |

**One-command setup for Hermes** — preconfigures every connector above plus wellness skills + onboarding: [`delx-wellness-hermes`](https://github.com/davidmosiah/delx-wellness-hermes).

<!-- /delx-wellness see-also -->

---

## Not medical advice

Nutrition estimates are approximate and intended for personal tracking and agent workflow context. They are not diagnosis, treatment, or medical advice. Confirm important nutrition decisions with a qualified professional.

**Unofficial.** Not affiliated with, endorsed by, or sponsored by USDA, Open Food Facts, or any third party. All trademarks belong to their respective owners.

## 📧 Contact & Support

- 📨 **support@delx.ai** — general questions, integration help, partnerships
- 🐛 **Bug reports / feature requests** — [GitHub Issues](https://github.com/davidmosiah/wellness-nourish/issues)
- 🐦 **Updates** — [@delx369](https://x.com/delx369) on X
- 🌐 **Site** — [wellness.delx.ai](https://wellness.delx.ai)
