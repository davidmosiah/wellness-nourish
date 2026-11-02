import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { SERVER_VERSION, NPM_PACKAGE_NAME, PINNED_NPM_PACKAGE } from '../dist/constants.js';
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const server=JSON.parse(readFileSync('server.json','utf8'));
assert.equal(SERVER_VERSION,pkg.version);
assert.equal(NPM_PACKAGE_NAME,pkg.name);
assert.equal(PINNED_NPM_PACKAGE,`${pkg.name}@${pkg.version}`);
assert.equal(server.version,pkg.version);
assert.ok(server.packages.some(x=>x.identifier===pkg.name && x.version===pkg.version));
if(existsSync('package-lock.json')) {
 const lock=JSON.parse(readFileSync('package-lock.json','utf8'));
 assert.equal(lock.version,pkg.version);assert.equal(lock.packages[''].version,pkg.version);
}
for(const file of ['skill/SKILL.md','README.md','llms.txt']) {
 const text=readFileSync(file,'utf8');assert.ok(text.includes(PINNED_NPM_PACKAGE),`${file} lacks pinned install example`);
}
console.log(JSON.stringify({ok:true,package:pkg.name,version:pkg.version,pin:PINNED_NPM_PACKAGE}));
