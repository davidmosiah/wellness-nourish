# Security Policy

Do not paste API keys, tokens, raw health exports, or private food logs into chats, tickets, prompts, or public issues.

Wellness Nourish stores local intake data at `~/.wellness-nourish/intake.jsonl` by default. Set `NOURISH_LOCAL_DIR` to move that storage path.

Use `nourish-mcp export` to review/export local intake JSONL. Use `nourish-mcp delete --entry <id>` to remove a local intake entry.

Report security issues privately to the repository owner. Do not publish private food logs, local storage files, tokens, or exploit details publicly before coordination.
