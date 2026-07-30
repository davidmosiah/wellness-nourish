import { existsSync, readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const packageLock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const serverJson = JSON.parse(readFileSync('server.json', 'utf8'));
const constantsSource = readFileSync('src/constants.ts', 'utf8');
const errors = [];

function requireFile(path) {
  if (!existsSync(path)) errors.push(`Missing required file: ${path}`);
}

requireFile('README.md');
if (packageJson.private !== true && packageJson.license !== 'UNLICENSED') {
  requireFile('LICENSE');
}
requireFile('llms.txt');
requireFile('server.json');

// Offline demo fixtures must ship with the npm package (README advertises
// NOURISH_FIXTURE_MODE=1 npx wellness-nourish search banana).
const requiredFixtures = [
  'fixtures/usda/search-banana.json',
  'fixtures/usda/food-banana.json',
  'fixtures/open-food-facts/barcode-peanut-butter.json',
];
for (const fixture of requiredFixtures) {
  requireFile(fixture);
}

if (serverJson.version !== packageJson.version) {
  errors.push(`server.json version ${serverJson.version} does not match package.json version ${packageJson.version}`);
}

if (packageLock.version !== packageJson.version) {
  errors.push(`package-lock.json version ${packageLock.version} does not match package.json version ${packageJson.version}`);
}

const rootPackage = packageLock.packages?.[''];
if (rootPackage?.version !== packageJson.version) {
  errors.push(`package-lock root package version ${rootPackage?.version} does not match package.json version ${packageJson.version}`);
}

const serverVersionMatch = constantsSource.match(/export const SERVER_VERSION = ["']([^"']+)["']/);
if (!serverVersionMatch) {
  errors.push('src/constants.ts must export SERVER_VERSION as a string literal.');
} else if (serverVersionMatch[1] !== packageJson.version) {
  errors.push(
    `SERVER_VERSION ${serverVersionMatch[1]} does not match package.json version ${packageJson.version}`,
  );
}

const expectsRegistryPackage = packageJson.private !== true && serverJson.publication?.npm !== false;
const npmPackage = serverJson.packages?.find((pkg) => pkg.registryType === 'npm');
if (expectsRegistryPackage && !npmPackage) {
  errors.push('server.json must declare an npm package.');
}
if (npmPackage) {
  if (npmPackage.identifier !== packageJson.name) {
    errors.push(`server.json package identifier ${npmPackage.identifier} does not match package name ${packageJson.name}`);
  }
  if (npmPackage.version !== packageJson.version) {
    errors.push(`server.json package version ${npmPackage.version} does not match package version ${packageJson.version}`);
  }
}

if (Array.isArray(packageJson.files) && !packageJson.files.includes('llms.txt')) {
  errors.push('package.json files must include llms.txt.');
}

if (Array.isArray(packageJson.files) && !packageJson.files.includes('fixtures')) {
  errors.push('package.json files must include fixtures (offline demo / fixture mode).');
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, metadata: true, package: packageJson.name, version: packageJson.version }, null, 2));
