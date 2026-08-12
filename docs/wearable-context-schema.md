# wearable_context — accepted fields (no invention)

Coach tools (`nourish_daily_coach`, `nourish_suggest_next_meal`, `nourish_pre_workout_nutrition`)
accept `wearable_context` as `delx-wellness-context/v1` (or a subset). Unknown keys are ignored.
Missing keys are not filled with fake WHOOP/Garmin/Strava numbers.

## Keys we read

| Field | Used as | Typical source |
|---|---|---|
| `source` | provenance string | any connector |
| `recovery_score` | poor `<50` / high `≥75` | WHOOP (and others if they emit it) |
| `body_battery` | poor `<30` / high `≥70` | Garmin |
| `strain_score` | high strain `>17` (0–21) | WHOOP |
| `relative_effort` | high strain `>200` | Strava |
| `hrv_ms` | signal only | WHOOP / Oura if present |
| `recent_training_load` | `low` \| `normal` \| `high` \| `unknown` | Garmin / training connectors |
| `context_type` | routing hint | envelope |
| `soreness_hint` | conservative copy | optional |

We do **not** invent `strain_score` from steps, or `recovery_score` from calories.

## Smoke

Pass a synthetic object — no live wearable required:

```json
{
  "source": "whoop",
  "recovery_score": 42,
  "strain_score": 8
}
```

Expected: poor-recovery meal path. Implementation: `src/services/coach.ts` `extractWearableSignals`.
Set `auto_wearable: true` to read `~/.delx-wellness/` if a connector already wrote the envelope.
