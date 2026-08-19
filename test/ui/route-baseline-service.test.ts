import assert from "node:assert/strict";
import test from "node:test";
import { createRouteBaselineService, ROUTE_BASELINE_TTL_MS } from "../../src/engine/routeBaselineService";
import type { Mode } from "../../src/engine/types";

const origin = { lat: 35.1578, lon: 129.0594 };
const destination = { lat: 35.1622, lon: 128.9851 };
const modes: Mode[] = ["walk", "car", "transit"];

function route(mode: Mode) {
  return { mode, geometry: [origin, { lat: 35.16, lon: 129.02 }, destination] };
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
    removeItem: async (key: string) => { values.delete(key); },
  };
}

test("기준 경로는 세 수단을 병렬로 조회하고 성공 geometry를 영속 캐시한다", async () => {
  const storage = memoryStorage();
  const calls: Mode[] = [];
  const service = createRouteBaselineService({
    storage,
    fetcher: { fetch: async (_origin, _destination, mode) => { calls.push(mode); return route(mode); } },
    now: () => 1_000,
  });

  const result = await service.get(origin, destination);

  assert.equal(result.status, "all_success");
  assert.deepEqual(new Set(calls), new Set(modes));
  assert.equal(storage.values.size, 1);
});

test("같은 기준 경로 요청은 메모리와 영속 캐시에서 재사용해 API를 다시 호출하지 않는다", async () => {
  const storage = memoryStorage();
  let calls = 0;
  const first = createRouteBaselineService({
    storage,
    fetcher: { fetch: async (_origin, _destination, mode) => { calls += 1; return route(mode); } },
    now: () => 1_000,
  });
  await first.get(origin, destination);
  await first.get(origin, destination);

  const afterMemory = calls;
  const restarted = createRouteBaselineService({
    storage,
    fetcher: { fetch: async () => { calls += 1; return null; } },
    now: () => 2_000,
  });
  const result = await restarted.get(origin, destination);

  assert.equal(afterMemory, 3);
  assert.equal(calls, 3);
  assert.equal(result.source, "persistent");
  assert.equal(result.status, "all_success");
});

test("같은 요청이 동시에 들어오면 세 수단 요청을 한 번씩만 공유한다", async () => {
  let calls = 0;
  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const service = createRouteBaselineService({
    fetcher: { fetch: async (_origin, _destination, mode) => { calls += 1; await pending; return route(mode); } },
    now: () => 1_000,
  });

  const first = service.get(origin, destination);
  const second = service.get(origin, destination);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 3);
  release?.();
  const [a, b] = await Promise.all([first, second]);

  assert.equal(a.status, "all_success");
  assert.equal(b.status, "all_success");
});

test("부분 실패는 성공 경로만 반환하고 실패 수단은 다음 요청에서 재시도한다", async () => {
  let transitAttempts = 0;
  const service = createRouteBaselineService({
    fetcher: {
      fetch: async (_origin, _destination, mode) => {
        if (mode === "transit") { transitAttempts += 1; return transitAttempts === 1 ? null : route(mode); }
        return route(mode);
      },
    },
    now: () => 1_000,
  });

  const partial = await service.get(origin, destination);
  const recovered = await service.get(origin, destination);

  assert.equal(partial.status, "partial_success");
  assert.deepEqual(partial.baselines.map((item) => item.mode), ["walk", "car"]);
  assert.equal(recovered.status, "all_success");
  assert.equal(transitAttempts, 2);
});

test("24시간 TTL이 지나면 기존 성공 경로를 폐기하고 다시 조회한다", async () => {
  let now = 1_000;
  let calls = 0;
  const service = createRouteBaselineService({
    fetcher: { fetch: async (_origin, _destination, mode) => { calls += 1; return route(mode); } },
    now: () => now,
  });
  await service.get(origin, destination);
  now += ROUTE_BASELINE_TTL_MS + 1;
  await service.get(origin, destination);

  assert.equal(calls, 6);
});

test("세 수단이 모두 실패하면 실패 결과를 영속 저장하지 않는다", async () => {
  const storage = memoryStorage();
  const service = createRouteBaselineService({
    storage,
    fetcher: { fetch: async () => null },
    now: () => 1_000,
  });

  const result = await service.get(origin, destination);

  assert.equal(result.status, "unavailable");
  assert.equal(storage.values.size, 0);
});
