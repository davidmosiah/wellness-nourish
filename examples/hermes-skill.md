# Nourish MCP

Use this skill whenever a user asks Hermes, including through Telegram, to search foods, estimate meals, log intake, log water, manage nutrition goals, or summarize nutrition through the Nourish MCP.

## Runtime Contract

- Prefer direct MCP tools exposed by Hermes.
- Start nutrition tasks with `mcp_nourish_nourish_connection_status` unless the user only asks for installation help.
- Use `mcp_nourish_nourish_capabilities` or `mcp_nourish_nourish_agent_manifest` when you need the machine-readable workflow contract.
- Do not use terminal, Python, curl or npm as a workaround for normal nutrition data access when MCP tools are available.
- After editing `/root/.hermes/config.yaml` or `~/.hermes/config.yaml`, reload MCP with `/reload-mcp` or `hermes mcp test nourish`.
- Do not restart the Hermes gateway for normal Nourish MCP config/data access. Restart only when Hermes itself is unhealthy.
- Never ask the user to paste provider API keys, tokens, raw health exports or private food logs into Telegram.
- Food logs, hydration and goals are personal data. Treat the configured local store as sensitive.
- Nutrition estimates are approximate context, not medical advice, diagnosis or treatment.

## Telegram Meal Logging

- If the user says `registra`, `anota`, `log`, `salva`, or otherwise clearly asks to save a meal, call `mcp_nourish_nourish_log_intake` with `explicit_user_intent: true`.
- If the user only says what they ate, first call `mcp_nourish_nourish_estimate_meal`, return a compact preview with calories, protein, confidence and warnings, then ask whether to save it.
- If the user sends a barcode photo and Hermes has an image path, base64 image, or data URI, call `mcp_nourish_nourish_lookup_barcode_image`; if only visible digits are available, call `mcp_nourish_nourish_lookup_barcode`.
- If the user sends a meal photo, describe the visible food and portions as `detected_items`, call `mcp_nourish_nourish_estimate_meal_photo`, then ask the user to confirm portions before logging.
- Preserve uncertainty. Include confidence and unresolved items instead of pretending estimates are exact.
- Use `response_format: markdown` for Telegram-facing summaries when available.

## First Calls

1. `mcp_nourish_nourish_connection_status`
2. `mcp_nourish_nourish_capabilities`
3. `mcp_nourish_nourish_estimate_meal` for natural-language meals
4. `mcp_nourish_nourish_lookup_barcode_image` for barcode photos
5. `mcp_nourish_nourish_estimate_meal_photo` for meal photo previews
6. `mcp_nourish_nourish_log_intake` only after explicit save intent
7. `mcp_nourish_nourish_daily_summary` for today's Telegram summary
