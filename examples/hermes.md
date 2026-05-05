# Hermes

For personal Hermes + Telegram usage, let the package write the MCP config and skill:

```bash
npx -y wellness-nourish setup --client hermes --profile david --local-dir /root/.hermes/nourish/david
npx -y wellness-nourish doctor --client hermes --json
hermes mcp test nourish
```

This writes `~/.hermes/config.yaml` and `~/.hermes/skills/nourish-mcp/SKILL.md`.
It also writes `~/.hermes/scripts/nourish-mcp-wrapper.sh`, which sources `~/.hermes/secrets/nourish.env` when present before executing the pinned package.

The resulting MCP server block uses this shape:

```json
{
  "name": "nourish",
  "command": "/root/.hermes/scripts/nourish-mcp-wrapper.sh",
  "env": {
    "NOURISH_OFF_ENABLED": "1",
    "NOURISH_LOCAL_DIR": "/root/.hermes/nourish/david"
  }
}
```

After config changes, reload MCP and call `nourish_connection_status`, `nourish_capabilities`, and `nourish_agent_manifest`.

Telegram flow:

1. Preview with `nourish_estimate_meal`.
2. For barcode photos, use `nourish_lookup_barcode_image` when Hermes has an image path, base64 image, or data URI.
3. For meal photos, use `nourish_estimate_meal_photo` from the visual observation and ask for portion confirmation.
4. Ask for confirmation unless the user clearly asked to save/register/log and the estimate is already confirmed.
5. Save with `nourish_log_intake` and `explicit_user_intent: true`.
6. Summarize with `nourish_daily_summary` or `nourish_weekly_summary`.
