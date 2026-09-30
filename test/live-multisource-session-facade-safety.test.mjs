import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync('src/services/liveMultiSourceSessionFacade.ts', 'utf8');

test('multisource facade has no persistence, logs, raw payload, coordinates, or retry ports', () => {
  assert.doesNotMatch(source, /AsyncStorage|supabase\.from|\.rpc\(|storage\.|caches\.|console\.|latitude|longitude|origin|destination|email|serviceKey|raw(Response|Body)|retry(Catalog|Snapshot)/i);
  assert.doesNotMatch(source, /budgetToken[^\n]*(return|status: 'active')/);
  assert.match(source, /return Object\.freeze\(\{ initialize, loadDetails, close, cancel, view \}\)/);
});

test('multisource facade is not connected to public UI or App entry', () => {
  const paths = ['App.tsx', ...fs.readdirSync('src/ui', { recursive: true }).filter((path) => /\.(ts|tsx)$/.test(String(path))).map((path) => `src/ui/${path}`)];
  for (const path of paths) if (fs.existsSync(path)) assert.doesNotMatch(fs.readFileSync(path, 'utf8'), /liveMultiSourceSessionFacade|createLiveMultiSourceSessionFacade/);
});
