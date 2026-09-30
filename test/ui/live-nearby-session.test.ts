import assert from 'node:assert/strict';
import test from 'node:test';
import type { LiveNearbyReadModel } from '../../src/data/liveNearbyReadModel';
import { createNearbyLiveSessionController, nearbyCatalogFromLiveModel } from '../../src/ui/nearbyLiveSession';
import { approvedPlacePhoto } from '../../src/ui/placePhotoModel';
import { buildNearbyBrowseDataset } from '../../src/ui/nearbyBrowseModel';

const candidate = { id: 'live-1', title: '현재 장소', lat: 35.1, lon: 129.1, address: '부산광역시 중구 현재길 1', description: '현행 설명', category: '관광지', subCategory: '전시', classification: 'representative_core', informationOnly: true, photoDisposition: 'approved_exact',
  photo: { status: 'approved', url: 'https://example.org/live.jpg', attribution: '공식 출처', sourcePageUrl: 'https://example.org/source', licenseName: '이용허락범위 제한 없음', commercialUseAllowed: true, modificationAllowed: true, verifiedAt: '2026-09-22' } } as const;
const model = (status: LiveNearbyReadModel['status'], candidates: readonly unknown[] = [candidate]) => ({ status, liveSourceSnapshotId: 'snapshot-nearby', candidates, records: [], summary: { runtimePlaces: 369, liveMappedPlaces: 251, active: candidates.length, inactive: 0, reviewRequired: 0, sourceUnavailable: 0, providerOutOfScope: 118 } }) as unknown as LiveNearbyReadModel;
const market = { id: 'market-1', title: '저장된 전통시장', lat: 35.1, lon: 129.1, address: '부산광역시 중구 시장길 1', category: '시장', classification: 'conditional_more', informationOnly: true, sourceKind: 'traditional_market_standard_static', operatingHoursStatus: 'unverified', photoDisposition: 'default_no_approved_evidence', provenance: { title: ['traditional_market_standard'], coordinates: ['traditional_market_standard'], address: ['traditional_market_standard'], description: [], photo: [] } } as const;

test('nearby live is created once on first load; repeated center choices use memory dataset', async () => {
  let created = 0, initialized = 0, details = 0, closed = 0, cancelled = 0;
  const controller = createNearbyLiveSessionController({
    createFacade: async () => { created++; return { status: 'ready', facade: { async initialize() { initialized++; return { status: 'active' }; }, async loadDetails() { details++; throw Error('forbidden'); }, close() { closed++; }, cancel() { cancelled++; } } } as never; },
    buildApprovedInput: () => ({} as never), project: () => model('ready'),
  });
  const first = await controller.load();
  const second = await controller.load();
  assert.equal(first, second);
  assert.equal(first.status, 'ready');
  assert.equal(created, 1); assert.equal(initialized, 1); assert.equal(details, 0);
  assert.equal(buildNearbyBrowseDataset({ lat: 35.1, lon: 129.1 }, first.catalog).length, 1);
  assert.equal(buildNearbyBrowseDataset({ lat: 35.2, lon: 129.2 }, first.catalog).length, 0);
  controller.cancel();
  assert.equal(cancelled, 1); assert.equal(closed, 1);
});

test('nearby display removes language suffix while retaining branch names and source facts', () => {
  const input = model('ready', [{ ...candidate, title: '해운대시장(한,영,중간,중번,일)' }, { ...candidate, id: 'other', title: '카페(부산점)' }]);
  assert.deepEqual(nearbyCatalogFromLiveModel(input).map(row => row.title), ['해운대시장', '카페(부산점)']);
  assert.equal(input.candidates[0].title, '해운대시장(한,영,중간,중번,일)');
});

test('partial shows confirmed live candidates only and never claims current opening hours', () => {
  const rows = nearbyCatalogFromLiveModel(model('partial', [candidate]));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, '현재 장소');
  assert.equal(rows[0].operatingHours, undefined);
  assert.equal(buildNearbyBrowseDataset({ lat: 35.1, lon: 129.1 }, rows)[0].hoursLabel, '운영시간 확인 필요');
  assert.equal(approvedPlacePhoto(rows[0])?.attribution, '공식 출처');
  assert.equal(approvedPlacePhoto({ ...rows[0], imageUrl: 'https://example.org/other.jpg' }), null);
});

test('nearby live place reuses only its own reviewed compatibility photo', () => {
  const rows = nearbyCatalogFromLiveModel(model('ready', [{
    ...candidate,
    id: 'poi_801',
    title: '실시간 롯데백화점 부산본점',
    photoDisposition: 'default_no_approved_evidence',
    photo: undefined,
  }]));
  assert.equal(rows[0].title, '실시간 롯데백화점 부산본점');
  assert.equal(approvedPlacePhoto(rows[0])?.status, 'operator_approved');
  assert.match(rows[0].imageUrl ?? '', /visitbusan\.net/);
});

test('static traditional market provenance survives the UI adapter and static-only partial is explicit', async () => {
  const projected = model('partial', [market]);
  const catalog = nearbyCatalogFromLiveModel(projected);
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0].sourceKind, 'traditional_market_standard_static');
  assert.equal(catalog[0].operatingHoursStatus, 'unverified');
  assert.equal(catalog[0].imageUrl, undefined);
  assert.equal(approvedPlacePhoto(catalog[0]), null);
  const malformedPhoto = nearbyCatalogFromLiveModel(model('partial', [{ ...market, photoDisposition: 'approved_exact', photo: candidate.photo }]));
  assert.equal(malformedPhoto[0].imageUrl, undefined, 'static market cannot borrow a live photo');
  const controller = createNearbyLiveSessionController({ createFacade: async () => ({ status: 'ready', facade: { async initialize() { return { status: 'active' }; }, close() {}, cancel() {} } } as never), buildApprovedInput: () => ({} as never), project: () => projected });
  const result = await controller.load();
  assert.equal(result.status, 'partial');
  assert.equal(result.staticMarketOnly, true);
  assert.equal(buildNearbyBrowseDataset({ lat: 35.1, lon: 129.1 }, result.catalog)[0].hoursLabel, '운영시간 확인 필요');
  controller.cancel();

  const mixed = createNearbyLiveSessionController({ createFacade: async () => ({ status: 'ready', facade: { async initialize() { return { status: 'active' }; }, close() {}, cancel() {} } } as never), buildApprovedInput: () => ({} as never), project: () => model('partial', [market, candidate]) });
  assert.equal((await mixed.load()).staticMarketOnly, false);
  mixed.cancel();
});

test('unavailable and provider-out-of-scope places never fall back to static successes', async () => {
  const controller = createNearbyLiveSessionController({ createFacade: async () => ({ status: 'ready', facade: { async initialize() { return { status: 'active' }; }, close() {}, cancel() {} } } as never), buildApprovedInput: () => ({} as never), project: () => model('unavailable', [candidate]) });
  const result = await controller.load();
  assert.equal(result.status, 'failed');
  assert.equal(result.catalog.length, 0);
  assert.deepEqual(nearbyCatalogFromLiveModel(model('ready', [])), []);
  controller.cancel();
});

test('missing current auth session fails before any source initialize or implicit auth retry', async () => {
  let initialized = 0, approved = 0;
  const controller = createNearbyLiveSessionController({
    createFacade: async () => ({ status: 'unavailable' } as never),
    buildApprovedInput: () => { approved++; return {} as never; },
    project: () => { initialized++; return model('ready'); },
  });
  assert.equal((await controller.load()).status, 'failed');
  assert.equal(approved, 0); assert.equal(initialized, 0);
  assert.equal((await controller.load()).status, 'failed');
  controller.cancel();
});

test('explicit retry after failure starts fresh facade; unmount cancellation discards late response', async () => {
  let calls = 0, release!: (value: unknown) => void, cancelled = 0;
  const controller = createNearbyLiveSessionController({
    createFacade: async () => ({ status: 'ready', facade: { async initialize() { calls++; if (calls === 1) return { status: 'blocked' }; return new Promise(resolve => { release = resolve; }); }, close() {}, cancel() { cancelled++; } } } as never),
    buildApprovedInput: () => ({} as never), project: () => model('ready'),
  });
  assert.equal((await controller.load()).status, 'failed');
  const pending = controller.retry();
  await new Promise<void>((resolve) => setImmediate(resolve));
  controller.cancel();
  release({ status: 'active' });
  assert.equal((await pending).status, 'failed');
  assert.equal(calls, 2); assert.ok(cancelled >= 2);
});
