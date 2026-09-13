import assert from 'node:assert/strict';
import test from 'node:test';
import { minimumStayForSpot } from '../../src/engine/recommendationPolicy';

const spots = [
  { contentId: 'walk', title: '도보 가능 장소', lat: 35.158, lon: 129.06, category: '문화시설', dwell: 25 },
  { contentId: 'transit', title: '대중교통 가능 장소', lat: 35.17, lon: 129.08, category: '자연관광', dwell: 20 },
  { contentId: 'car-only', title: '차량 전용 먼 장소', lat: 35.23, lon: 129.17, category: '문화시설', dwell: 20 },
];

// Preserved engine contract; retired oneStop UI algorithm cases removed.
test('후보 게이트도 자투리 활동 카탈로그의 장소별 최소 체류를 사용한다', () => {
  const spot = {
    ...spots[0],
    dwell: 60,
    minStayMin: 15,
    recommendedStayMin: 25,
    maxStayMin: 35,
    availabilityProfile: 'facility' as const,
  };
  assert.equal(minimumStayForSpot({ ...spot, typeId: 'fixture', dwellBase: 60, dwellSrc: 'fixture', mult: 1, openNote: '', confidence: 'direct_match', strategy: 'origin_area' }, 5), 15);
});
