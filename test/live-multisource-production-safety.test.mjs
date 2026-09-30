import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const factory = fs.readFileSync('src/services/liveMultiSourceProductionFactory.ts', 'utf8');
const production = fs.readFileSync('src/services/liveMultiSourceSupabaseProduction.ts', 'utf8');
const receipt = fs.readFileSync('src/services/liveMultiSourceProductionReceipt.ts', 'utf8');

test('production composition reuses current session and has no sign-in, CAPTCHA, persistence, raw logs, or weak IDs', () => {
  const source = `${factory}\n${production}\n${receipt}`;
  assert.match(production, /supabase\.auth\.getSession\(\)/);
  assert.match(production, /uuid\.v4\(\)/);
  assert.doesNotMatch(source, /signInAnonymously|captcha|AsyncStorage|console\.|Math\.random|JSON\.stringify\(error|throw new Error\([^)]*error/i);
  assert.doesNotMatch(factory, /retryCatalog|retrySnapshot|accessToken[^\n]*(return|status: 'ready')/);
});

test('public UI defaults to live ports, fails closed, and has no bundled-place fallback gate', () => {
  const entry = fs.readFileSync('src/ui/recommendation/v1Session.ts', 'utf8');
  const liveComposition = fs.readFileSync('src/ui/recommendation/livePublicDataSession.ts', 'utf8');
  const nearbyScreen = fs.readFileSync('src/ui/NearbyBrowseScreen.tsx', 'utf8');
  const nearbyComposition = fs.readFileSync('src/ui/nearbyLiveSession.ts', 'utf8');
  assert.doesNotMatch(entry, /EXPO_PUBLIC_LIVE_PUBLIC_DATA_ENABLED/);
  assert.match(entry, /if \(!dependencies\.useLegacyStaticFixture\?\.\(\)\) \{[\s\S]*?await import\('\.\/livePublicDataSession'\)/);
  assert.match(entry, /throw error instanceof LivePublicDataUnavailableError \? error : new LivePublicDataUnavailableError\(\)/);
  assert.doesNotMatch(liveComposition, /livePublicDataEnabled|EXPO_PUBLIC_LIVE_PUBLIC_DATA_ENABLED/);
  assert.doesNotMatch(nearbyScreen, /EXPO_PUBLIC_LIVE_PUBLIC_DATA_ENABLED|busan_poi_catalog\.json|\bliveEnabled\b/);
  assert.match(nearbyScreen, /if \(!center\) return;/);
  assert.match(nearbyComposition, /export async function productionNearbyLivePorts\(\)[\s\S]*?import\('\.\.\/services\/liveMultiSourceSupabaseProduction'\)/);
  assert.doesNotMatch(nearbyComposition, /^import\s+(?!type\b)[^;]*liveMultiSourceSupabaseProduction/m);
  const paths = ['App.tsx', ...fs.readdirSync('src/ui', { recursive: true }).filter((path) => /\.(ts|tsx)$/.test(String(path))).map((path) => `src/ui/${path}`)];
  for (const path of paths) {
    if (!fs.existsSync(path) || path === 'src/ui/recommendation/livePublicDataSession.ts' || path === 'src/ui/nearbyLiveSession.ts') continue;
    const source = fs.readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /liveMultiSourceProductionFactory|liveMultiSourceSupabaseProduction|createSupabaseLiveMultiSourceFacade/, `${path} bypasses the gated entry`);
    if (path !== 'src/ui/recommendation/v1Session.ts') assert.doesNotMatch(source, /(?:import|require)\s*\(?['"][^'"]*livePublicDataSession['"]/, `${path} eagerly loads the gated entry`);
    if (path !== 'src/ui/NearbyBrowseScreen.tsx') assert.doesNotMatch(source, /(?:import|require)\s*\(?['"][^'"]*nearbyLiveSession['"]/, `${path} bypasses the nearby gate`);
  }
});
