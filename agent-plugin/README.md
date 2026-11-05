# Nourish — Agent Plugins package

Portable [Agent Plugins](https://agent-plugins.org/) v1 package for
[Hermes Agent](https://github.com/NousResearch/hermes-agent) and other Agent Plugins clients:
the `nourish` MCP server (`wellness-nourish@0.9.0` over stdio) plus the `wellness-nourish` workflow skill.

## Install (Hermes Agent)

```bash
hermes plugins install davidmosiah/wellness-nourish/agent-plugin --no-enable
hermes plugins enable wellness-nourish
```

Requires Node.js 20+ (`npx` on PATH). The skill loads as `wellness-nourish:wellness-nourish`.

## Connector setup

```bash
npx -y wellness-nourish@0.9.0 doctor
```

Works without setup. For higher USDA rate limits the user can add a free FoodData Central key (fdc.nal.usda.gov) to their environment as `FDC_API_KEY` (or the supported alias `USDA_FDC_API_KEY`) before starting Hermes. The plugin explicitly forwards these optional credentials; unset or empty values are omitted by Hermes, preserving the default DEMO_KEY fallback. If both are set, `FDC_API_KEY` takes precedence.

## Disclosure

- **Runtime and supply chain.** Hermes starts `npx -y wellness-nourish@0.9.0` over stdio with `cwd: ${PLUGIN_DATA}` (Node.js 20+). npm downloads that exact package version and its dependencies on first start; transitive npm dependencies follow the published package's ranges. The pinned Git commit covers this portable manifest and skill, not the separately downloaded npm runtime. There is no self-updater or telemetry. The stdio process runs while connected; this package starts no background daemon or HTTP listener.
- **Network and provider data.** Food queries and requested food IDs go to USDA FoodData Central (`api.nal.usda.gov`); product-name queries and barcode numbers go to Open Food Facts (`world.openfoodfacts.org`). No diary or photo is uploaded automatically. USDA uses `DEMO_KEY` without setup. Optional `FDC_API_KEY` / `USDA_FDC_API_KEY` values are resolved by Hermes and passed explicitly to this server, then sent only to USDA to authenticate requests. The package does not read credential files or store these keys. Preserve USDA attribution and Open Food Facts ODbL attribution/share-alike metadata in exports. Brazilian meal estimates also use the bundled TACO 4 reference subset with NEPA/UNICAMP attribution.
- **Local data outside the plugin directory.** The npm runtime uses `~/.wellness-nourish/` by default, independent of `PLUGIN_DATA`: `intake.jsonl`, `hydration.jsonl`, `goals.json`, and meal memory. Provider caches are in memory. It reads and updates the shared wellness profile at `~/.delx-wellness/profile.json`. If that profile is absent, profile reads may migrate an existing non-secret wellness profile from `~/.hermes/profiles/delx-wellness/wellness-profile.json` or `~/.openclaw-delx-wellness/workspace/wellness-profile.json`. Wearable-context tools read `~/.delx-wellness/wearable-context.json` or `~/.delx-wellness/wearable-context/*.json` when present. These locations are shared across Hermes profiles using the same OS home; `PLUGIN_DATA` is not a data-isolation boundary.
- **Images.** Barcode tools decode supplied bytes locally with Sharp/ZXing, or read a user-selected image from the runtime's allowed local image roots (the Nourish data directory or OS temporary directory by default). Meal photos require agent-provided visual observations. Nothing is uploaded automatically; a requested barcode/product lookup sends the extracted barcode or product query to the provider.
- **Writes and deletion.** `nourish_log_intake`, `nourish_bulk_log_intake`, `nourish_update_intake`, `nourish_log_water`, `nourish_set_goals`, `nourish_remember_meal` and `nourish_profile_update` change local data. Confirm estimates before logging. `nourish_delete_intake`, `nourish_clear_day`, `nourish_delete_water`, `nourish_clear_hydration_day`, `nourish_forget_memory` and `nourish_undo_last` remove or reverse local diary data; confirm before using them. Profile read/onboarding/coaching paths can perform the legacy-profile migration described above.
- **Host access and privacy.** Requested diary, profile and summary tool results return to Hermes/the calling agent and may enter its model context. Local storage does not mean data stays outside the host conversation. Structured output is the default; summary privacy mode is optional. Use only personal data the user authorized.
- **Scope.** No OAuth, hosted account, payment or autonomous sync. The tool set comes from the pinned npm version. Nutrition estimates are informational, not medical advice. This project is not affiliated with USDA, Open Food Facts or NEPA/UNICAMP.
