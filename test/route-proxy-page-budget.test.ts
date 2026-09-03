import assert from 'node:assert/strict';
import test from 'node:test';
import { createCourseV1ProxyRouteAdapter, type RouteProxyFunctionInvoker } from '../src/services/routeProxyClientAdapter';

const scope = { kind: 'public_segment' as const, catalogVersion: 'page-fixture-v1', fromPoiId: 'from', toPoiId: 'to' };
const from = { id: 'from', lat: 35.1, lon: 129 };
const to = { id: 'to', lat: 35.2, lon: 129.1 };
const walkExact = { mode: 'walk' as const, status: 'ok' as const, totalMin: 8, receipt: { result: 'exact' as const, newProviderAttemptCount: 1 as const, reuse: 'provider_attempt' as const } };

test('API-PAGE-01: 첫 8/조건부 16/이어보기 페이지 8은 miss attempt와 cache hit attempt 0을 분리한다', async () => {
  let invocations = 0;
  const invoker: RouteProxyFunctionInvoker = { async invoke(request) {
    invocations += 1;
    const index = Number((request.scope as { fromPoiId?: string }).fromPoiId?.replace('from-', ''));
    return index < 16 ? walkExact : { ...walkExact, receipt: { ...walkExact.receipt, newProviderAttemptCount: 0, reuse: 'server_cache_hit' as const } };
  } };
  const adapter = createCourseV1ProxyRouteAdapter({ invoker, resolveScope: (origin, destination) => ({ kind: 'public_segment', catalogVersion: 'page-fixture-v1', fromPoiId: origin.id, toPoiId: destination.id }) });
  const segment = (index: number) => [{ id: `from-${index}`, lat: 35.1 + index / 1000, lon: 129 }, to] as const;
  for (let index = 0; index < 8; index += 1) {
    const [origin, destination] = segment(index);
    assert.equal((await adapter.getRouteReceipt(origin, destination, { maxNewProviderAttemptCount: 1 })).newProviderAttemptCount, 1);
  }
  assert.equal(invocations, 8);
  for (let index = 8; index < 16; index += 1) {
    const [origin, destination] = segment(index);
    assert.equal((await adapter.getRouteReceipt(origin, destination, { maxNewProviderAttemptCount: 1 })).newProviderAttemptCount, 1);
  }
  assert.equal(invocations, 16);
  for (let index = 0; index < 8; index += 1) {
    const [origin, destination] = segment(index + 16);
    const receipt = await adapter.getRouteReceipt(origin, destination, { maxNewProviderAttemptCount: 1 });
    assert.deepEqual([receipt.result, receipt.newProviderAttemptCount, receipt.reused], ['exact', 0, true]);
  }
  assert.equal(invocations, 24);
});

test('API-PAGE-01: Edge in-flight receipt는 provider attempt 0으로 구분되고 client는 요청을 합치지 않는다', async () => {
  let resolve!: () => void; let invocations = 0;
  const ready = new Promise<void>((done) => { resolve = done; });
  const invoker: RouteProxyFunctionInvoker = { async invoke() {
    invocations += 1;
    if (invocations === 1) { await ready; return walkExact; }
    return { ...walkExact, receipt: { ...walkExact.receipt, newProviderAttemptCount: 0, reuse: 'in_flight_reuse' as const } };
  } };
  const adapter = createCourseV1ProxyRouteAdapter({ invoker, resolveScope: () => scope });
  const first = adapter.getRouteReceipt(from, to, { maxNewProviderAttemptCount: 1 });
  const second = adapter.getRouteReceipt(from, to, { maxNewProviderAttemptCount: 1 });
  resolve();
  const [firstReceipt, secondReceipt] = await Promise.all([first, second]);
  assert.deepEqual([invocations, firstReceipt.newProviderAttemptCount, secondReceipt.newProviderAttemptCount, secondReceipt.reused], [2, 1, 0, true]);
});

test('API-PAGE-01: typed unavailable은 cache하지 않아 provider stop을 성공 receipt로 바꾸지 않는다', async () => {
  let invocations = 0;
  const invoker: RouteProxyFunctionInvoker = { async invoke() { invocations += 1; return { mode: 'walk', status: 'limited', receipt: { result: 'unavailable', newProviderAttemptCount: 0, reuse: 'provider_attempt', unavailableReason: 'limited' } }; } };
  const adapter = createCourseV1ProxyRouteAdapter({ invoker, resolveScope: () => scope });
  const first = await adapter.getRouteReceipt(from, to, { maxNewProviderAttemptCount: 1 });
  const second = await adapter.getRouteReceipt(from, to, { maxNewProviderAttemptCount: 1 });
  assert.deepEqual([first.result, second.result, invocations], ['unavailable', 'unavailable', 2]);
});
