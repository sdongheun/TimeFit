import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRouteBaselineService } from '../src/engine/routeBaselineService';
import { createKakaoLocationSearchAdapter } from '../src/services/kakaoLocationSearchAdapter';
import { createAuthenticatedRouteProxyInvoker } from '../src/services/routeProxyClientAdapter';

const a = { lat: 35.12345, lon: 129.12345 }, b = { lat: 35.23456, lon: 129.23456 };

// Execute the real legacy transport with isolated credentials, storage and HTTP fixtures.
function transport(failed = false) {
  const logs: unknown[][] = []; let calls = 0;
  const values = new Map<string, string>();
  const storage = { getItem: async (k: string) => values.get(k) ?? null, setItem: async (k: string, v: string) => { values.set(k, v); } };
  const code = ts.transpileModule(fs.readFileSync('src/engine/travel.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports: any = {};
  vm.runInNewContext(code, { exports, require: (id: string) => {
    if (id.includes('async-storage')) return storage;
    if (id === './routeBaselineService') return { createRouteBaselineService: () => ({}) };
    if (id === '../services/placeNameSemanticMatch') return {};
    throw new Error('unexpected_fixture_import');
  }, process: { env: { EXPO_PUBLIC_TMAP_APP_KEY: 'fixture', EXPO_PUBLIC_ODSAY_API_KEY: 'fixture' } }, URLSearchParams,
  console: { log: (...args: unknown[]) => logs.push(args), info: (...args: unknown[]) => logs.push(args) },
  fetch: async () => { calls++; if (failed) throw new Error('fixture-sensitive-error'); return { ok: true, json: async () => ({ features: [{ properties: { totalTime: 300 }, geometry: { type: 'LineString', coordinates: [[a.lon, a.lat], [b.lon, b.lat]] } }] }) }; } });
  return { api: exports, logs, calls: () => calls };
}

test('SAFETY-01: actual legacy success/failure/cancel logs contain no coordinates or raw errors', async () => {
  for (const failed of [false, true]) {
    const run = transport(failed);
    await run.api.precompute([[a, b]], 'walk');
    await run.api.precompute([[a, b]], 'walk');
    assert.equal(run.calls(), 1);
    assert.ok(run.logs.length > 0);
    const output = JSON.stringify(run.logs);
    for (const sensitive of [String(a.lat), String(a.lon), String(b.lat), String(b.lon), 'fixture-sensitive-error']) assert.equal(output.includes(sensitive), false, 'sensitive log field');
    const cancelled = transport();
    await cancelled.api.precompute([[a, b]], 'walk', { transportObserver: { recordProviderHttpAttempt: () => false } });
    assert.equal(cancelled.calls(), 0);
  }
  const transit = transport(true);
  await transit.api.precomputeTransit([[a, b]]);
  assert.equal(transit.calls(), 0); // ODsay removal: no legacy transit HTTP
  assert.equal(JSON.stringify(transit.logs).includes(String(a.lat)), false);
});

test('SAFETY-02: consumer mutation cannot poison a cached location search or add calls', async () => {
  let calls = 0;
  const adapter = createKakaoLocationSearchAdapter({ searchers: { place: async () => {
    calls++; return { provider: 'kakao', status: 'ok', pois: [{ name: 'fixture', lat: a.lat, lon: a.lon, addr: 'fixture address' }] };
  } } });
  const first = await adapter.search('fixture');
  first.suggestions[0].lat = 0;
  first.suggestions.length = 0;
  const second = await adapter.search('fixture');
  assert.equal(second.suggestions.length, 1);
  assert.equal(second.suggestions[0].lat, a.lat);
  assert.equal(calls, 1);
});

test('SAFETY-03: baseline memory isolation retains geometry and request counts', async () => {
  let calls = 0;
  const service = createRouteBaselineService({ fetcher: { fetch: async (_a, _b, mode) => { calls++; return { mode, geometry: [{ ...a }, { ...b }] }; } } });
  const first = await service.get(a, b);
  first.baselines[0].geometry[0].lat = 0;
  const second = await service.get(a, b);
  assert.equal(second.baselines[0].geometry[0].lat, a.lat);
  assert.equal(calls, 3);
});

test('SAFETY-04: memory-only baseline replacement changes restart fetch count (decision evidence)', async () => {
  const values = new Map<string, string>();
  const storage = { getItem: async (k: string) => values.get(k) ?? null, setItem: async (k: string, v: string) => { values.set(k, v); }, removeItem: async (k: string) => { values.delete(k); } };
  let calls = 0;
  const fetcher = { fetch: async (_a: typeof a, _b: typeof b, mode: 'walk' | 'car' | 'transit') => { calls++; return { mode, geometry: [a, b] }; } };
  await createRouteBaselineService({ fetcher, storage }).get(a, b);
  calls = 0;
  await createRouteBaselineService({ fetcher, storage }).get(a, b);
  assert.equal(calls, 0);
  await createRouteBaselineService({ fetcher }).get(a, b);
  assert.equal(calls, 3);
});


test('SAFETY-06: raw Edge rejection and cancellation are safe failures, never route success', async () => {
  for (const name of ['Error', 'AbortError']) {
    const error = new Error('fixture-private-error'); error.name = name;
    const invoker = createAuthenticatedRouteProxyInvoker({ accessToken: 'fixture-token', edge: { invoke: async () => { throw error; } } });
    await assert.rejects(invoker.invoke({ mode: 'walk', scope: { kind: 'private_request' }, origin: a, destination: b }), (result: unknown) => result instanceof Error && result.message === 'route_proxy_transport_failed');
  }
});

test('SAFETY-07: concurrent baseline consumers cannot mutate each other', async () => {
  let calls = 0;
  const service = createRouteBaselineService({ fetcher: { fetch: async (_a, _b, mode) => { calls++; return { mode, geometry: [{ ...a }, { ...b }] }; } } });
  const [first, second] = await Promise.all([service.get(a, b), service.get(a, b)]);
  first.baselines[0].geometry[0].lat = 0;
  assert.equal(second.baselines[0].geometry[0].lat, a.lat);
  assert.equal(calls, 3);
});
