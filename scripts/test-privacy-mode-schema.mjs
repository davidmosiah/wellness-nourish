import assert from 'node:assert/strict';
// Drive shipped schema builders (built dist)
import {
  FoodSearchInputSchema,
  SummaryInputSchema,
  ResponseOnlyInputSchema,
} from '../dist/schemas/common.js';

for (const [name, schema] of [
  ['FoodSearchInputSchema', FoodSearchInputSchema],
  ['SummaryInputSchema', SummaryInputSchema],
  ['ResponseOnlyInputSchema', ResponseOnlyInputSchema],
]) {
  const shape = schema.shape ?? schema._def?.shape?.();
  // zod 4: use safeParse with privacy_mode
  const parsed = schema.safeParse(
    name === 'FoodSearchInputSchema'
      ? { query: 'rice', privacy_mode: 'summary' }
      : name === 'SummaryInputSchema'
        ? { privacy_mode: 'structured' }
        : { privacy_mode: 'raw' },
  );
  assert.equal(parsed.success, true, `${name} must accept privacy_mode: ${JSON.stringify(parsed.error)}`);
  assert.equal(parsed.data.privacy_mode === 'summary' || parsed.data.privacy_mode === 'structured' || parsed.data.privacy_mode === 'raw', true);
}

// Reject invalid mode
const bad = FoodSearchInputSchema.safeParse({ query: 'x', privacy_mode: 'secret' });
assert.equal(bad.success, false, 'invalid privacy_mode must fail');

console.log(JSON.stringify({ ok: true, suite: 'privacy-mode-schema' }, null, 2));
