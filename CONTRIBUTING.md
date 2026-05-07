# Contributing

Contributions are welcome, especially around nutrition normalization, barcode lookup, intake workflows, pt-BR parsing, privacy-safe summaries and agent setup examples.

## Local development

```bash
npm ci
npm run typecheck
npm run build
npm run smoke
npm run smoke:http
npm run test:metadata
```

## Design rules

- Never commit food logs, photos, generated local stores, API keys or private health context.
- Keep fixture mode available for tests and agent verification.
- Preserve explicit quantities and gram/unit handling.
- Prefer dry, structured errors that help agents recover without exposing sensitive payloads.
- Keep nutrition outputs informational, not medical advice.

## Pull request checklist

- `npm run typecheck` passes.
- `npm run build` passes.
- Relevant targeted tests pass.
- `npm run smoke:http` passes when HTTP behavior changes.
- `npm run test:metadata` passes when package metadata changes.
- README/tools docs are updated when behavior changes.
