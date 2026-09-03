import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildExplorationPageV1,
  verifySelectedExplorationPlaceV1,
  EXPLORATION_SELECTION_ADAPTER_CALL_LIMIT,
  EXPLORATION_SELECTION_PROVIDER_ATTEMPT_LIMIT,
  type CourseV1DiscoveryCandidate,
  type CourseV1Point,
  type CourseV1RouteReceipt,
  type CourseV1RouteReceiptAdapter,
} from '../src/engine/courseV1';

const now = new Date('2026-08-24T10:00:00+09:00');
const origin = { id: 'origin', lat: 35.1578, lon: 129.0594 };

function place(
  id: string,
  discovery: CourseV1DiscoveryCandidate['discovery'],
  extra: Partial<CourseV1DiscoveryCandidate> = {},
): CourseV1DiscoveryCandidate {
  return {
    id, title: id, lat: 35.15, lon: 129.06,
    classification: discovery.eligibility === 'representative' ? 'representative_standard' : 'conditional_more',
    minStayMin: 20, recommendedStayMin: 30, maxStayMin: 60,
    availability: { status: 'structured', alwaysAccessible: true, dayTypes: ['weekday', 'weekend'], windows: [{ startMin: 0, endMin: 1440 }] },
    discovery,
    ...extra,
  };
}

function receipts(plans: Record<string, CourseV1RouteReceipt>, calls: string[]): CourseV1RouteReceiptAdapter {
  return {
    async getRouteReceipt(from, to, budget) {
      calls.push(`${from.id}>${to.id}`);
      const receipt = plans[`${from.id}>${to.id}`] ?? { result: 'no_route' as const, newProviderAttemptCount: 1 as const, reused: false };
      return receipt.newProviderAttemptCount <= budget.maxNewProviderAttemptCount
        ? receipt
        : { result: 'unavailable', newProviderAttemptCount: 0, reused: false };
    },
  };
}

function input(candidates: readonly CourseV1DiscoveryCandidate[], cursor?: number) {
  return { now, origin, destination: null, remainingMin: 90, arrivalBufferMin: 5, candidates, pageSize: 7, cursor };
}

test('2-P: 20개 이상 탐색 목록은 로컬 페이지 소비만 하며 place/siteGroup 중복과 route 입력이 없다', () => {
  const candidates = Array.from({ length: 23 }, (_, index) => place(`place-${String(index).padStart(2, '0')}`, { eligibility: 'representative', placeKind: 'facility' }));
  candidates.push(place('same-id', { eligibility: 'representative', placeKind: 'facility' }));
  candidates.push(place('same-id', { eligibility: 'representative', placeKind: 'facility' }));
  candidates.push(place('same-group-a', { eligibility: 'representative', placeKind: 'facility' }, { siteGroupId: 'shared' }));
  candidates.push(place('same-group-b', { eligibility: 'representative', placeKind: 'facility' }, { siteGroupId: 'shared' }));

  const ids: string[] = [];
  let cursor: number | null = undefined as unknown as number | null;
  do {
    const page = buildExplorationPageV1(input(candidates, cursor ?? undefined));
    ids.push(...page.places.map((item) => item.placeId));
    cursor = page.nextCursor;
  } while (cursor !== null);

  assert.equal(ids.length, 25);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes('same-group-a') !== ids.includes('same-group-b'));
});

test('2-P: representative와 접근 근거 area_access만 탐색에 남기고 access snapshot을 보존한다', () => {
  const areaAccess = place('beach', {
    eligibility: 'area_access', placeKind: 'outdoor',
    accessEvidence: { status: 'public_outdoor_access', source: 'official', sourceId: 'beach-1', checkedAt: '2026-08-23', sourceText: 'public access' },
    accessWindow: { kind: 'always', dayTypes: ['weekday', 'weekend'], windows: [] },
  });
  const page = buildExplorationPageV1(input([
    place('representative', { eligibility: 'representative', placeKind: 'facility' }),
    areaAccess,
    place('conditional-street', { eligibility: 'conditional', placeKind: 'area' }),
    place('invalid-facility', { eligibility: 'area_access', placeKind: 'facility', accessEvidence: areaAccess.discovery.accessEvidence, accessWindow: areaAccess.discovery.accessWindow }),
  ]));

  assert.deepEqual(page.places.map((item) => item.placeId), ['beach', 'representative']);
  assert.deepEqual(page.places[0]?.accessWindow, areaAccess.discovery.accessWindow);
  assert.equal(page.places.some((item) => item.placeId === 'conditional-street' || item.placeId === 'invalid-facility'), false);
});

test('2-P: 상단 대표 place는 탐색에서 제외하지만 대표가 없으면 탐색은 독립적으로 반환한다', () => {
  const primary = place('primary', { eligibility: 'representative', placeKind: 'facility' });
  const area = place('area', {
    eligibility: 'area_access', placeKind: 'area',
    accessEvidence: { status: 'public_outdoor_access', source: 'official', sourceId: 'area-2', checkedAt: '2026-08-23', sourceText: 'public access' },
    accessWindow: { kind: 'always', dayTypes: ['weekday', 'weekend'], windows: [] },
  });
  const candidates = [primary, area];

  assert.deepEqual(buildExplorationPageV1({ ...input(candidates), excludedPlaceIds: ['primary'] }).places.map((item) => item.placeId), ['area']);
  assert.deepEqual(buildExplorationPageV1(input(candidates)).places.map((item) => item.placeId), ['area', 'primary']);
});

test('2-P: facility area_access는 선택 전 fail-closed되며 receipt를 호출하지 않는다', async () => {
  const calls: string[] = [];
  const invalid = place('facility', {
    eligibility: 'area_access', placeKind: 'facility',
    accessEvidence: { status: 'public_outdoor_access', source: 'official', sourceId: 'facility-1', checkedAt: '2026-08-23', sourceText: 'not sufficient' },
    accessWindow: { kind: 'always', dayTypes: ['weekday', 'weekend'], windows: [] },
  });
  const result = await verifySelectedExplorationPlaceV1({ ...input([invalid]), selectedPlaceId: 'facility', receiptRoutes: receipts({}, calls) });
  assert.deepEqual(result, { state: 'rejected', reason: 'exploration_place_not_eligible', receipt: { adapterCallCount: 0, newProviderAttemptCount: 0, cacheOrSessionReuseCount: 0 } });
  assert.deepEqual(calls, []);
});

test('2-P: 선택 성공은 독립 1곳 snapshot만 반환하고 대표/탐색 목록을 바꾸지 않는다', async () => {
  const selected = place('selected', { eligibility: 'representative', placeKind: 'facility' });
  const candidates = [selected, place('other', { eligibility: 'representative', placeKind: 'facility' })];
  const before = buildExplorationPageV1(input(candidates));
  const calls: string[] = [];
  const result = await verifySelectedExplorationPlaceV1({
    ...input(candidates), selectedPlaceId: 'selected',
    receiptRoutes: receipts({
      'origin>selected': { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false },
      'selected>origin': { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false },
    }, calls),
  });

  assert.equal(result.state, 'verified');
  if (result.state === 'verified') {
    assert.deepEqual(result.course.placeIds, ['selected']);
    assert.equal(result.course.legs.length, 2);
    assert.equal(result.course.stops[0]?.stayState, 'recommended');
  }
  assert.deepEqual(buildExplorationPageV1(input(candidates)), before);
  assert.deepEqual(calls, ['origin>selected', 'selected>origin']);
  assert.ok(result.receipt.adapterCallCount <= EXPLORATION_SELECTION_ADAPTER_CALL_LIMIT);
  assert.ok(result.receipt.newProviderAttemptCount <= EXPLORATION_SELECTION_PROVIDER_ATTEMPT_LIMIT);
});

test('2-P: route/time/access 선택 실패는 목록을 바꾸지 않고 자동 재시도하지 않는다', async () => {
  const route = place('route', { eligibility: 'representative', placeKind: 'facility' });
  const time = place('time', { eligibility: 'representative', placeKind: 'facility' });
  const access = place('access', {
    eligibility: 'area_access', placeKind: 'area',
    accessEvidence: { status: 'public_outdoor_access', source: 'official', sourceId: 'area-1', checkedAt: '2026-08-23', sourceText: 'scheduled access' },
    accessWindow: { kind: 'scheduled', dayTypes: ['weekday'], windows: [{ startMin: 600, endMin: 630 }] },
  });
  const candidates = [route, time, access];
  const before = buildExplorationPageV1(input(candidates));
  const cases: Array<{ id: string; reason: 'route_not_verified' | 'time_budget_exceeded' | 'access_window_unavailable'; plans: Record<string, CourseV1RouteReceipt>; expectedCalls: number }> = [
    { id: 'route', reason: 'route_not_verified', plans: {}, expectedCalls: 1 },
    {
      id: 'time', reason: 'time_budget_exceeded', expectedCalls: 2,
      plans: {
        'origin>time': { result: 'exact', route: { mode: 'walk', min: 40, exact: true }, newProviderAttemptCount: 1, reused: false },
        'time>origin': { result: 'exact', route: { mode: 'walk', min: 40, exact: true }, newProviderAttemptCount: 1, reused: false },
      },
    },
    {
      id: 'access', reason: 'access_window_unavailable', expectedCalls: 1,
      plans: { 'origin>access': { result: 'exact', route: { mode: 'walk', min: 15, exact: true }, newProviderAttemptCount: 1, reused: false } },
    },
  ];

  for (const item of cases) {
    const calls: string[] = [];
    const result = await verifySelectedExplorationPlaceV1({ ...input(candidates), selectedPlaceId: item.id, receiptRoutes: receipts(item.plans, calls) });
    assert.equal(result.state, 'rejected');
    if (result.state === 'rejected') assert.equal(result.reason, item.reason);
    assert.equal(calls.length, item.expectedCalls);
    assert.deepEqual(buildExplorationPageV1(input(candidates)), before);
  }
});
