import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('TourAPI live boundary has no persistence/logging/location operation or public key read', async () => {
  const files = ['supabase/functions/tourapi-live/handler.ts', 'supabase/functions/tourapi-live/index.ts', 'src/services/tourApiLiveAdapter.ts'];
  const source = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
  assert.doesNotMatch(source, /locationBasedList2|EXPO_PUBLIC_TOURAPI_KEY|AsyncStorage|supabase\.from|storage\.|caches\.|console\.|mapX|mapY|latitude|longitude/);
  assert.match(source, /createLiveProviderBudgetPort/);
  assert.doesNotMatch(source, /\.rpc\(['"](?!reserve_live_provider_attempt)/);
  assert.doesNotMatch(source, /JSON\.stringify\([^)]*(raw|error)/);
});
