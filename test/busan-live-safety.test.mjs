import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Busan live boundary has no persistence, logging, client coordinates, or configurable provider endpoint', async () => {
  const files = ['supabase/functions/busan-live/handler.ts', 'supabase/functions/busan-live/index.ts', 'src/services/busanLiveAdapter.ts'];
  const source = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
  assert.doesNotMatch(source, /AsyncStorage|supabase\.from|storage\.|caches\.|console\.|latitude|longitude|userId|EXPO_PUBLIC_/);
  assert.match(source, /createLiveProviderBudgetPort/);
  assert.doesNotMatch(source, /\.rpc\(['"](?!reserve_live_provider_attempt)/);
  assert.doesNotMatch(source, /JSON\.stringify\([^)]*(raw|error)|approvedSourceIds\s*:\s*.*MAIN_TITLE/);
  assert.doesNotMatch(source, /\.\.\/\.\.\/\.\.\/src\//);
  assert.match(source, /Cache-Control': 'no-store'/);
});

test('Busan provider endpoints and budgets are fixed in the server boundary', async () => {
  const source = await readFile('supabase/functions/busan-live/handler.ts', 'utf8');
  for (const value of ['AttractionService/getAttractionKr', 'FoodService/getFoodKr', 'ShoppingService/getShoppingKr', "url.searchParams.set('ServiceKey'", "url.searchParams.set('numOfRows'", "url.searchParams.set('resultType', 'json')"]) assert.match(source, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(source, /request\.(url|query)|row\.(baseURL|pageNo|ServiceKey)/);
});
