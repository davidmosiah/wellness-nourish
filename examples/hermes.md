# Hermes

Use the package command as the MCP server command:

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

After config changes, reload MCP and call `nourish_connection_status`, `nourish_capabilities`, and `nourish_agent_manifest`.
