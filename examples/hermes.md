# Hermes

For personal Hermes + Telegram usage, let the package write the MCP config and skill:

```bash
npx -y wellness-nourish setup --client hermes --profile david --local-dir /root/.hermes/nourish/david
npx -y wellness-nourish doctor --client hermes --json
hermes mcp test nourish
```

This writes `~/.hermes/config.yaml` and `~/.hermes/skills/nourish-mcp/SKILL.md`.

The resulting MCP server block uses this shape:

```json
{
  "name": "nourish",
  "command": "npx",
  "args": ["-y", "wellness-nourish@0.1.1"],
  "env": {
    "NOURISH_OFF_ENABLED": "1",
    "NOURISH_LOCAL_DIR": "/root/.hermes/nourish/david"
  }
}
```

After config changes, reload MCP and call `nourish_connection_status`, `nourish_capabilities`, and `nourish_agent_manifest`.

Telegram flow:

1. Preview with `nourish_estimate_meal`.
2. Ask for confirmation unless the user clearly asked to save/register/log.
3. Save with `nourish_log_intake` and `explicit_user_intent: true`.
4. Summarize with `nourish_daily_summary` or `nourish_weekly_summary`.
