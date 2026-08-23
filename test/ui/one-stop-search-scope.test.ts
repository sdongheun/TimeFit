import assert from 'node:assert/strict';
import test from 'node:test';
import { filterOneStopCandidatesByRadius } from '../../src/ui/recommendation/oneStopSearchScope';

const origin = { lat: 35.1578, lon: 129.0594 };
const destination = { lat: 35.1578, lon: 129.1194 };
const spots = [
  { contentId: 'near', title: '기본 범위', lat: 35.158, lon: 129.068, category: '카페', dwell: 30 },
  { contentId: 'wide', title: '확장 범위', lat: 35.18, lon: 129.09, category: '카페', dwell: 30 },
];
const baselines = [{ mode: 'walk' as const, geometry: [origin, destination] }];

test('기본 1km에서는 가까운 후보만 보이고, 명시적 확장에서만 원거리 후보를 추가한다', () => {
  const base = filterOneStopCandidatesByRadius({ spots, origin, destination, baselines, radiusM: 1_000 });
  const expanded = filterOneStopCandidatesByRadius({ spots, origin, destination, baselines, radiusM: 3_000 });

  assert.deepEqual(base.map((spot) => spot.contentId), ['near']);
  assert.deepEqual(expanded.map((spot) => spot.contentId), ['near', 'wide']);
});
