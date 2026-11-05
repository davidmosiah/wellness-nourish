// Optional credential forwarding is an explicit, narrow contract with Hermes.
// Do not replace ${NAME} with shell defaults: Hermes omits unresolved whole refs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const manifest = JSON.parse(read('agent-plugin/mcp.json'));
const expectedKeys = ["FDC_API_KEY", "USDA_FDC_API_KEY"];
assert.deepEqual(Object.keys(manifest.mcpServers), ["nourish"]);
const server = manifest.mcpServers["nourish"];
assert.deepEqual(Object.keys(server.env).sort(), [...expectedKeys].sort(),
  'Forward only supported provider credentials; no unrelated secrets');
for (const key of expectedKeys) {
  assert.equal(server.env[key], '${' + key + '}',
    key + ' must remain an optional whole-variable reference');
}
assert.equal(server.type, 'stdio');
assert.equal(server.command, 'npx');
assert.deepEqual(server.args, ['-y', "wellness-nourish@0.9.0"]);
assert.equal(server.cwd, '${PLUGIN_DATA}');
console.log('Agent plugin optional credential and launch contracts passed');
