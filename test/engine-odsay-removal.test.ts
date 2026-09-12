import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import type { Leg } from '../src/engine/types';

const a = { lat: 35.1, lon: 129.0 }, b = { lat: 35.3, lon: 129.2 };
function harness() {
  const requests: string[] = [], reads: string[] = [], writes: string[] = [];
  const api: any = {};
  const code = ts.transpileModule(fs.readFileSync('src/engine/travel.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports: api, require: (id: string) => {
    if (id.includes('async-storage')) return { getItem: async () => null, setItem: async (key: string) => { writes.push(key); } };
    if (id === './routeBaselineService') return { createRouteBaselineService: () => ({}) };
    if (id === '../services/placeNameSemanticMatch') return {};
    throw new Error(`unexpected import: ${id}`);
  }, process: { env: new Proxy({ EXPO_PUBLIC_TMAP_APP_KEY: 'fixture', EXPO_PUBLIC_ODSAY_API_KEY: 'fixture', ODSAY_API_KEY: 'fixture' }, { get(target, key: string) { reads.push(key); return target[key as keyof typeof target]; } }) },
  URLSearchParams, console: { log() {}, info() {} }, fetch: async (url: string) => { requests.push(String(url)); return { ok: false }; } });
  return { api, requests, reads, writes };
}

test('2-ODSAY-REMOVE-01: injected keys, near/far/retry transit are no-route with zero HTTP/key reads/writes', async () => {
  const h = harness();
  for (const destination of [a, { lat: 35.101, lon: 129.001 }, b]) {
    const result = await h.api.precomputeTransit([[a, destination]], { retryFallback: true });
    assert.equal(result.ok, 0);
    assert.equal(result.fail, 1);
    assert.equal(h.api.travelMin(a, destination, 'transit'), Infinity);
    assert.equal(h.api.travelSrc(a, destination, 'transit'), 'transit_fallback');
    assert.equal(h.api.travelGeo(a, destination, 'transit'), undefined);
    assert.equal(h.api.transitMeta(a, destination), undefined);
  }
  assert.deepEqual(h.requests, []);
  assert.deepEqual(h.reads.filter(key => /ODSAY/.test(key)), []);
  assert.deepEqual(h.writes, []);
  const usage = await h.api.getOdsayTransitUsage();
  assert.deepEqual([usage.total, usage.ok, usage.fail], [0, 0, 0]);
  assert.deepEqual(h.writes, []);
});

test('2-ODSAY-REMOVE-01: failed TMAP walk never opens another transport and disabled observer gate does not invoke request', async () => {
  const h = harness();
  await h.api.precompute([[a, b]], 'walk');
  await h.api.precomputeTransit([[a, b]]);
  assert.equal(h.requests.length, 1);
  assert.ok(h.requests[0].includes('/routes/pedestrian'));
  assert.equal(h.api.travelSrc(a, b, 'walk'), 'haversine');
  let invoked = 0;
  await h.api.attemptLegacyRouteHttp('odsay', undefined, async () => { invoked++; });
  assert.equal(invoked, 0);
});

test('2-ODSAY-REMOVE-01: historic leg remains a read-only snapshot, not a new route cache entry', () => {
  const h = harness();
  const old: Leg = { label: '과거 대중교통', mode: 'transit', min: 25, src: 'ODsay', geo: [a, b] };
  const parsed: Leg = JSON.parse(JSON.stringify(old));
  assert.deepEqual(parsed, old);
  assert.equal(h.api.travelMin(a, b, parsed.mode), Infinity);
  assert.notEqual(h.api.travelSrc(a, b, parsed.mode), parsed.src);
  assert.deepEqual(h.requests, []);
  assert.deepEqual(h.writes, []);
});
