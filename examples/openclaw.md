# OpenClaw

Register `nourish` as a stdio MCP server:

```json
{
  "name": "nourish",
  "command": "npx",
  "args": ["-y", "wellness-nourish"],
  "env": {
    "FDC_API_KEY": "${FDC_API_KEY}",
    "NOURISH_OFF_ENABLED": "1",
    "NOURISH_LOCAL_DIR": "~/.wellness-nourish"
  }
}
```

Use direct MCP tools for reads and mutations. Agents should preview or summarize before logging, and only mutate intake, hydration, or goals after explicit user intent.
