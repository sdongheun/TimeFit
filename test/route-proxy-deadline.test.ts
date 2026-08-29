import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ROUTE_PROXY_DEADLINE_SAFETY_MS,
  resolveRouteProxyDeadlineConfig,
  withinProviderDeadline,
} from '../supabase/functions/route-proxy/deadline';

test('API4AR2R-01: lease TTL보다 안전 여유만큼 짧은 deadline만 provider 호출에 사용할 수 있다', () => {
  assert.deepEqual(resolveRouteProxyDeadlineConfig({ leaseTtlMs: 5_000, providerDeadlineMs: 5_000 - ROUTE_PROXY_DEADLINE_SAFETY_MS }), { leaseTtlMs: 5_000, providerDeadlineMs: 4_750 });
  assert.equal(resolveRouteProxyDeadlineConfig({ leaseTtlMs: 999, providerDeadlineMs: 100 }), null);
  assert.equal(resolveRouteProxyDeadlineConfig({ leaseTtlMs: 5_000, providerDeadlineMs: 4_751 }), null);
  assert.equal(resolveRouteProxyDeadlineConfig({ leaseTtlMs: 'invalid', providerDeadlineMs: 100 }), null);
});

test('API4AR2R-02: deadline은 AbortSignal을 전달하고 timeout 뒤 완료된 provider 결과를 쓰지 않는다', async () => {
  let aborted = false;
  const result = await withinProviderDeadline(5, async (signal) => {
    await new Promise<void>((resolve) => signal.addEventListener('abort', () => { aborted = true; resolve(); }, { once: true }));
    return 'late-provider-result';
  });

  assert.equal(aborted, true);
  assert.deepEqual(result, { status: 'deadline_exceeded' });
});
