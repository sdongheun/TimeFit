import test from 'node:test';
import assert from 'node:assert/strict';
import { createActualRouteSearchScope, isPointInActualRouteSearchScope, RouteBaseline } from '../../src/engine/actualRouteSearchScope';
import { planTimeFit } from '../../src/engine/planner';

// 부산 대표 좌표 fixtures
const SEOMYEON = { lat: 35.1578, lon: 129.0594 }; // 서면
const SASANG = { lat: 35.1627, lon: 128.9856 };   // 사상역
const BUSAN_STATION = { lat: 35.1152, lon: 129.0422 }; // 부산역 (서면-사상 축 밖 남쪽)
const GWANGANLI = { lat: 35.1532, lon: 129.1186 }; // 광안리 (서면 동쪽 해변)
const JEONPO = { lat: 35.1555, lon: 129.0635 };   // 전포 (서면 1km 생활권 내)
const GAMJEON = { lat: 35.1550, lon: 128.9890 };  // 감전 (사상 1km 생활권 내)
const GAYA = { lat: 35.1530, lon: 129.0250 };     // 가야 (서면-사상 중간 이동축)

// 서면 → 사상 실제 도로/대중교통 기준 경로 형상 (가야대로 축)
const SEOMYEON_TO_SASANG_BASELINE: RouteBaseline = {
  mode: 'transit',
  geometry: [
    SEOMYEON,
    { lat: 35.1550, lon: 129.0420 }, // 부암/당감 방면
    GAYA,                           // 가야
    { lat: 35.1510, lon: 129.0080 }, // 주례
    GAMJEON,                        // 감전
    SASANG,                         // 사상
  ],
};

test('시나리오 1: 서면→사상 이동 축 경로 주변 장소만 수집하고 축 밖(부산역)은 배제한다', () => {
  const scope = createActualRouteSearchScope({
    origin: SEOMYEON,
    destination: SASANG,
    radiusM: 1000,
    baselines: [SEOMYEON_TO_SASANG_BASELINE],
  });

  // 서면 생활권, 가야(중간 경로), 사상 생활권은 포함
  assert.equal(isPointInActualRouteSearchScope(JEONPO, scope), true, '서면 생활권 전포는 포함되어야 함');
  assert.equal(isPointInActualRouteSearchScope(GAYA, scope), true, '이동 축 중간 지점 가야는 포함되어야 함');
  assert.equal(isPointInActualRouteSearchScope(GAMJEON, scope), true, '사상 생활권 감전은 포함되어야 함');

  // 이동 축에서 벗어난 부산역 및 광안리는 배제
  assert.equal(isPointInActualRouteSearchScope(BUSAN_STATION, scope), false, '축 밖 부산역은 1km 반경에 포함되지 않아야 함');
  assert.equal(isPointInActualRouteSearchScope(GWANGANLI, scope), false, '축 밖 광안리는 포함되지 않아야 함');
});

test('시나리오 2: 서면 왕복 120분 - 기본 1km는 서면 생활권만, 슬라이더 8km 확장 시 원거리 포함', () => {
  const defaultScope = createActualRouteSearchScope({
    origin: SEOMYEON,
    destination: null, // 왕복
    radiusM: 1000,
    baselines: [],
  });

  const expandedScope = createActualRouteSearchScope({
    origin: SEOMYEON,
    destination: null, // 왕복
    radiusM: 8000,
    baselines: [],
  });

  // 기본 1km 생활권
  assert.equal(isPointInActualRouteSearchScope(JEONPO, defaultScope), true, '1km 기본 범위: 전포 포함');
  assert.equal(isPointInActualRouteSearchScope(GWANGANLI, defaultScope), false, '1km 기본 범위: 광안리 미포함');
  assert.equal(isPointInActualRouteSearchScope(SASANG, defaultScope), false, '1km 기본 범위: 사상 미포함');

  // 슬라이더 8km 확장 범위
  assert.equal(isPointInActualRouteSearchScope(JEONPO, expandedScope), true, '8km 확장: 전포 포함');
  assert.equal(isPointInActualRouteSearchScope(GWANGANLI, expandedScope), true, '8km 확장: 광안리 포함');
  assert.equal(isPointInActualRouteSearchScope(SASANG, expandedScope), true, '8km 확장: 사상 포함');
});

test('시나리오 3: 3개 수단 기준 경로 전체 실패 시 양 끝 1km 생활권으로 안전하게 축소된다', () => {
  const scope = createActualRouteSearchScope({
    origin: SEOMYEON,
    destination: SASANG,
    radiusM: 8000, // 사용자가 슬라이더를 8km로 올려도 기준 경로 실패 시에는 양 끝 1km만 사용
    baselines: [], // 전체 실패
  });

  // 양 끝 1km 생활권은 포함
  assert.equal(isPointInActualRouteSearchScope(JEONPO, scope), true, '출발지 1km 생활권 전포 포함');
  assert.equal(isPointInActualRouteSearchScope(GAMJEON, scope), true, '도착지 1km 생활권 감전 포함');

  // 경로 실패 상태에서는 중간 축이나 먼 장소는 안전하게 배제
  assert.equal(isPointInActualRouteSearchScope(GAYA, scope), false, '경로 실패 시 중간 축 가야는 미포함 (직선 폴백 금지)');
  assert.equal(isPointInActualRouteSearchScope(BUSAN_STATION, scope), false, '경로 실패 시 부산역 미포함');
});

test('시나리오 4: TIME-01 시간 모델 - 현재 시각 기준 남은 시간 예산이 정확히 계산된다', async () => {
  const nowMin = 14 * 60 + 30; // 14:30
  const remainingMin = 120; // 2시간 자투리

  const plan = await planTimeFit({
    origin: SEOMYEON,
    destination: null,
    remainingMin,
    mode: 'transit',
    candidateModes: ['walk', 'transit', 'car'],
    radiusM: 8000,
    mapExploration: true,
    nowMin,
    dayType: '평일',
    hourBucket: '오후',
  });

  assert.equal(plan.budgetMin, remainingMin - 20, '대중교통 안전 여유 20분 차감된 예산');
  assert.ok(plan.spatialCandidates.length > 0, '후보 장소가 수집되어야 함');
  // 모든 수집된 후보는 로컬 운영시간 게이트를 통과했어야 함
  assert.equal(plan.eligibleCount, plan.spatialCandidates.length);
});
