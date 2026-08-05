# First meal in 2 minutes (agent-first)

## Claude Desktop / Cursor

1. Install: `npx -y wellness-nourish` in MCP config (see README).
2. Agent first calls:
   - `nourish_connection_status` or `nourish_agent_manifest`
   - `nourish_estimate_meal` with text e.g. `"2 eggs and black coffee"` locale `pt-BR` if Brazilian meal
3. Review confidence + unresolved items.
4. Only after user confirms: log with `explicit_user_intent: true`.

## Demo without network food APIs
Use fixtures under `fixtures/` and demo tools when present — never invent USDA rows.

Issue #25 path: this doc is the agent-first 2-minute meal path.
