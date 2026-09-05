import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildNearbyBrowseDataset,
  clusterNearbyMarkers,
  createNearbyLocationGuard,
  createNearbySelectionState,
  parseNearbyMapMessage,
  type NearbyCatalogPlace,
} from '../../src/ui/nearbyBrowseModel';

const center = { lat: 35, lon: 129 };
const north = (id: string, meters: number, extra: Partial<NearbyCatalogPlace> = {}): NearbyCatalogPlace => ({
  contentId: id,
  title: id,
  lat: center.lat + meters / 111_195,
  lon: center.lon,
  category: '문화시설',
  classification: 'representative_core',
  ...extra,
});

test('UNEAR failure-first: raw distance includes 2999/3000 and excludes 3001, then stable ID breaks ties', () => {
  const rows = buildNearbyBrowseDataset(center, [north('z', 2999), north('b', 3000), north('a', 3000), north('out', 3001)]);
  assert.deepEqual(rows.map(row => row.id), ['z', 'a', 'b']);
  assert.ok(rows[2].distanceM <= 3000);
});

test('UNEAR selector rejects invalid/id duplicates/hold but keeps conditional as information with honest hours', () => {
  const rows = buildNearbyBrowseDataset(center, [
    north('', 10), north('bad', 10, { lat: Number.NaN }), north('dup', 20), north('dup', 30),
    north('hold', 30, { classification: 'hold' }),
    north('conditional', 40, { classification: 'conditional_more', operatingHours: [] }),
    north('closed', 50, { operatingHours: ['월요일 휴무'] }),
  ]);
  assert.deepEqual(rows.map(row => row.id), ['dup', 'conditional', 'closed']);
  assert.equal(rows[1].informationKind, 'conditional');
  assert.equal(rows[1].hoursLabel, '운영시간 확인 필요');
  assert.doesNotMatch(JSON.stringify(rows), /영업 중|인기|평점|혼잡/);
});

test('UNEAR viewport changes do not reorder; a reference change does', () => {
  const catalog = [north('near', 50), north('far', 500)];
  const initial = buildNearbyBrowseDataset(center, catalog);
  const afterPan = buildNearbyBrowseDataset(center, catalog);
  assert.deepEqual(afterPan.map(row => row.id), initial.map(row => row.id));
  const changed = buildNearbyBrowseDataset({ lat: north('far', 500).lat, lon: 129 }, catalog);
  assert.deepEqual(changed.map(row => row.id), ['far', 'near']);
});

test('UNEAR clusters are display-only and same-coordinate members remain accessible', () => {
  const rows = buildNearbyBrowseDataset(center, [north('a', 20), north('b', 20), north('c', 800)]);
  const clusters = clusterNearbyMarkers(rows, point => ({ x: point.lon * 10_000, y: point.lat * 10_000 }), 8);
  assert.deepEqual(clusters.map(group => group.ids), [['a', 'b'], ['c']]);
  assert.deepEqual(rows.map(row => row.id), ['a', 'b', 'c']);
});

test('UNEAR marker/list share one selected ID and closing detail preserves selection/list state', () => {
  const state = createNearbySelectionState(['a', 'b']);
  assert.equal(state.select('a'), true);
  assert.equal(state.openDetail('a'), true);
  state.closeDetail();
  assert.deepEqual(state.snapshot(), { selectedId: 'a', detailId: null });
  assert.equal(state.select('outside'), false);
});

test('UNEAR location guard ignores stale GPS after manual choice or leave', () => {
  const guard = createNearbyLocationGuard();
  const gps = guard.begin();
  guard.invalidate();
  assert.equal(guard.accept(gps), false);
  const second = guard.begin();
  assert.equal(guard.accept(second), true);
  assert.equal(guard.accept(second), false);
});

test('UNEAR WebView bridge accepts only allowlisted actions and current dataset IDs', () => {
  const ids = new Set(['a', 'b']);
  assert.deepEqual(parseNearbyMapMessage('{"action":"select","id":"a"}', ids), { action: 'select', id: 'a' });
  assert.deepEqual(parseNearbyMapMessage('{"action":"cluster","ids":["a","b"]}', ids), { action: 'cluster', ids: ['a', 'b'] });
  assert.equal(parseNearbyMapMessage('{"action":"select","id":"stale"}', ids), null);
  assert.equal(parseNearbyMapMessage('{"action":"route","id":"a"}', ids), null);
  assert.equal(parseNearbyMapMessage('not-json', ids), null);
  assert.deepEqual(parseNearbyMapMessage('{"action":"error","reason":"sdk_init"}', ids), { action: 'error', reason: 'sdk_init' });
  assert.deepEqual(parseNearbyMapMessage('{"action":"error","reason":"secret raw error"}', ids), { action: 'error' });
});
