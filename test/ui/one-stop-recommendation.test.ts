import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOneStopRecommendations } from '../../src/ui/recommendation/oneStop';
import { minimumStayForSpot } from '../../src/engine/recommendationPolicy';

const origin = { lat: 35.1578, lon: 129.0594 };
const target = { lat: 35.153, lon: 129.118 };

const spots = [
  { contentId: 'walk', title: '도보 가능 장소', lat: 35.158, lon: 129.06, category: '문화시설', dwell: 25 },
  { contentId: 'transit', title: '대중교통 가능 장소', lat: 35.17, lon: 129.08, category: '자연관광', dwell: 20 },
  { contentId: 'car-only', title: '차량 전용 먼 장소', lat: 35.23, lon: 129.17, category: '문화시설', dwell: 20 },
];

test('단일 장소 추천은 도보와 대중교통 중 가능한 수단만 사용하고 차량 전용 후보를 제외한다', () => {
  const items = buildOneStopRecommendations({
    spots,
    origin,
    target,
    remainingMin: 120,
    arrivalBufferMin: 10,
    estimate: ({ spot, mode }) => {
      if (spot.contentId === 'walk' && mode === 'walk') return { approachMin: 8, onwardMin: 18 };
      if (spot.contentId === 'transit' && mode === 'transit') return { approachMin: 18, onwardMin: 22 };
      // 현행 API는 차량 모드를 전달하지 않는다. 이 줄은 차량 전용 장소가
      // 도보/대중교통 후보에 섞이지 않는 회귀 검증용이다.
      if (spot.contentId === 'car-only' && (mode as string) === 'car') return { approachMin: 12, onwardMin: 15 };
      return { approachMin: 90, onwardMin: 90 };
    },
  });

  assert.deepEqual(items.map((item) => item.spot.contentId), ['walk', 'transit']);
  assert.deepEqual(items.map((item) => item.mode), ['walk', 'transit']);
});

test('권장 체류가 가능하면 추천, 최소 체류만 가능하면 짧게 가능으로 구분한다', () => {
  const items = buildOneStopRecommendations({
    spots: [
      { ...spots[0], contentId: 'recommended', dwell: 30 },
      { ...spots[1], contentId: 'short', dwell: 35 },
    ],
    origin,
    target,
    remainingMin: 80,
    arrivalBufferMin: 10,
    estimate: ({ spot }) => spot.contentId === 'recommended'
      ? { approachMin: 10, onwardMin: 20 }
      : { approachMin: 15, onwardMin: 25 },
  });

  assert.equal(items[0].status, 'recommended');
  assert.equal(items[1].status, 'short');
  assert.equal(items[1].availableStayMin, 30);
});

test('사용자 도착 여유가 커지면 같은 장소의 체류 가능 시간도 그만큼 줄어든다', () => {
  const common = {
    spots: [spots[0]], origin, target, remainingMin: 90,
    estimate: () => ({ approachMin: 12, onwardMin: 18 }),
  };
  const ten = buildOneStopRecommendations({ ...common, arrivalBufferMin: 10 })[0];
  const twenty = buildOneStopRecommendations({ ...common, arrivalBufferMin: 20 })[0];
  assert.equal(ten.availableStayMin - twenty.availableStayMin, 10);
});

test('정제 카탈로그의 최소·권장 체류 범위가 기존 단일 체류값보다 우선한다', () => {
  const [item] = buildOneStopRecommendations({
    spots: [{ ...spots[0], dwell: 60, minStayMin: 15, recommendedStayMin: 25, maxStayMin: 35 }],
    origin,
    target,
    remainingMin: 60,
    arrivalBufferMin: 10,
    estimate: () => ({ approachMin: 12, onwardMin: 18 }),
  });

  assert.equal(item.minimumStayMin, 15);
  assert.equal(item.recommendedStayMin, 25);
  assert.equal(item.availableStayMin, 20);
  assert.equal(item.status, 'short');
});

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

test('정밀 경로에서 성공한 이동수단만 다시 평가해 근사값 수단이 추천을 바꾸지 않는다', () => {
  const [item] = buildOneStopRecommendations({
    spots: [spots[0]], origin, target, remainingMin: 80, arrivalBufferMin: 10,
    modes: ['walk'],
    estimate: () => ({ approachMin: 12, onwardMin: 20 }),
  });

  assert.equal(item.mode, 'walk');
  assert.equal(item.status, 'recommended');
  assert.equal(item.availableStayMin, 38);
});
