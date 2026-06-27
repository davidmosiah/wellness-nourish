# Wellness Nourish — Hermes / Telegram personal setup

For a personal Hermes server connected to your Telegram bot, let the package write the Hermes config and skill:

```bash
npx -y wellness-nourish setup --client hermes --profile david --local-dir /root/.hermes/nourish/david
npx -y wellness-nourish doctor --client hermes --json
hermes mcp test nourish
```

This adds a `nourish` MCP server block to `~/.hermes/config.yaml`, installs `~/.hermes/skills/nourish-mcp/SKILL.md`, and pins the npm package version. After config changes, use `/reload-mcp` or `hermes mcp test nourish`.

Hermes setup also writes `~/.hermes/scripts/nourish-mcp-wrapper.sh`. The wrapper sources `~/.hermes/secrets/nourish.env` when present, so `FDC_API_KEY` can be managed as a server-side secret without pasting it into chat or relying on a stale shell session.

## Recommended Telegram flow

1. User says what they ate.
2. Hermes calls `nourish_estimate_meal` and replies with calories, protein, confidence and warnings.
3. For barcode photos, Hermes calls `nourish_lookup_barcode_image` when it has an image path, base64 image, or data URI.
4. For mixed food photos, Hermes calls `nourish_analyze_food_image` with barcode observations, label OCR, detected items, or image description.
5. For meal photos, Hermes describes visible food and portions, calls `nourish_estimate_meal_photo`, and asks for portion confirmation.
6. For "what should I eat now?" questions, Hermes calls `nourish_daily_coach` or `nourish_suggest_next_meal`, optionally passing wearable context from WHOOP/Garmin/Oura.
7. For repeated meals, Hermes can call `nourish_remember_meal` after explicit user intent so future phrases like "meu café normal" expand locally.
8. User confirms saving.
9. Hermes calls `nourish_log_intake` with `explicit_user_intent: true`.
10. User can ask for `today`, weekly summaries, goals, hydration, edits, deletes or exports.

## One-command alternative

Both runtime bundles preconfigure this connector plus the full Delx Wellness stack into a dedicated profile:

```bash
npx -y delx-wellness-hermes setup
hermes -p delx-wellness
```

See [`delx-wellness-hermes`](https://github.com/davidmosiah/delx-wellness-hermes) and [`delx-wellness-openclaw`](https://github.com/davidmosiah/delx-wellness-openclaw).
