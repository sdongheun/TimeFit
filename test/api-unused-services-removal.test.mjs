import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const retired = ['kakaoReverseGeocodeAdapter', 'placeSearchSuggestionAdapter', 'routeProxyAdapter', 'routeProviderAdapter', 'legacyRouteBaselineCleanup'];
const removed = new Set(retired.map(name => `src/services/${name}.ts`));
const symbols = ['reverseGeocodeSelection', 'searchPlaceSuggestions', 'createServerRouteProxy', 'createMemoryRouteProxyStore', 'createRouteProviderClients', 'chooseWalkProvider', 'resolveWalkRoute', 'resolveTransitRoute', 'disabledRouteProvider', 'purgeLegacyRouteBaselineCache'];
function files(root) {
  if (!fs.existsSync(root)) return [];
  if (fs.statSync(root).isFile()) return [root];
  return fs.readdirSync(root).flatMap(name => files(path.join(root, name)));
}
test('retired API service deletion set has no outside production imports, dynamic strings or entry references', () => {
  const pattern = new RegExp(`\\b(?:${[...retired, ...symbols].join('|')})\\b`);
  const incoming = ['App.tsx', 'index.ts', 'src', 'scripts', 'supabase', 'plugins'].flatMap(files)
    .filter(file => !removed.has(file) && /\.(?:[cm]?[jt]sx?|json|sql|sh|swift)$/.test(file))
    .filter(file => pattern.test(fs.readFileSync(file, 'utf8')));
  assert.deepEqual(incoming, []);
});
for (const file of removed) test(`unused service is absent: ${file}`, () => assert.equal(fs.existsSync(file), false));
