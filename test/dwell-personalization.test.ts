import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveDwellPersonalizationV1,
  type DwellPersonalizationSampleV1,
} from '../src/engine/dwellPersonalization';

const samples = (
  dwellMins: readonly number[],
  category = '상업지구',
  subCategory = '거리·골목',
): DwellPersonalizationSampleV1[] => dwellMins.map((dwellMin) => ({ category, subCategory, dwellMin }));

const derive = (
  dwellMins: readonly number[],
  overrides: Partial<Parameters<typeof deriveDwellPersonalizationV1>[0]> = {},
) => deriveDwellPersonalizationV1({
  category: '상업지구',
  subCategory: '거리·골목',
  minStayMin: 20,
  recommendedStayMin: 30,
  maxStayMin: 60,
  samples: samples(dwellMins),
  ...overrides,
});

test('2-AB: 3건부터 최신 5건 중앙값만 결정적으로 사용한다', () => {
  assert.deepEqual(derive([20, 30]), {
    state: 'not_applied', recommendedStayMin: 30, validSampleCount: 2, windowSampleCount: 2,
  });
  assert.equal(derive([20, 30, 120]).recommendedStayMin, 30); // 평균 57을 쓰지 않는다.
  assert.equal(derive([20, 30, 40]).recommendedStayMin, 30); // mode가 없어도 결정적이다.
  assert.equal(derive([20, 30, 40, 50]).recommendedStayMin, 35);
  assert.equal(derive([20, 30, 40, 50, 60]).recommendedStayMin, 40);
  const latestFive = derive([120, 20, 25, 30, 35, 40]);
  assert.equal(latestFive.recommendedStayMin, 30);
  assert.deepEqual([latestFive.validSampleCount, latestFive.windowSampleCount], [6, 5]);
});

test('2-AB: 홀수·짝수 중앙값과 Math.round 5분 경계를 고정한다', () => {
  assert.equal(derive([20, 32, 50]).recommendedStayMin, 30);
  assert.equal(derive([20, 35, 40, 50]).recommendedStayMin, 40); // median 37.5 -> 40
  assert.equal(derive([20, 30, 35, 50]).recommendedStayMin, 35); // median 32.5 -> 35
  assert.equal(derive([20, 32.4, 50]).recommendedStayMin, 30);
  assert.equal(derive([20, 32.5, 50]).recommendedStayMin, 35);
});

test('2-AB: 기본 대비 ±10분을 먼저, 장소 min/max를 다음에 clamp한다', () => {
  assert.equal(derive([100, 110, 120]).recommendedStayMin, 40);
  assert.equal(derive([1, 5, 10]).recommendedStayMin, 20);
  assert.equal(derive([100, 110, 120], { maxStayMin: 35 }).recommendedStayMin, 35);
  assert.equal(derive([1, 5, 10], { minStayMin: 25 }).recommendedStayMin, 25);
});

test('2-AB: category+subCategory를 정확히 격리하고 missing·invalid 표본을 제외한다', () => {
  const mixed: DwellPersonalizationSampleV1[] = [
    ...samples([20, 30, 40]),
    ...samples([100, 110, 120], '자연', '거리·골목'),
    ...samples([100, 110, 120], '상업지구', '시장'),
    { category: '상업지구', subCategory: '거리·골목', dwellMin: Number.NaN },
    { category: '상업지구', subCategory: '거리·골목', dwellMin: Number.POSITIVE_INFINITY },
    { category: '상업지구', subCategory: '거리·골목', dwellMin: 0 },
    { category: '상업지구', subCategory: '거리·골목', dwellMin: -10 },
  ];
  assert.deepEqual(derive([], { samples: mixed }), {
    state: 'applied', recommendedStayMin: 30, validSampleCount: 3, windowSampleCount: 3,
  });
  assert.deepEqual(derive([20, 30, 40], { subCategory: undefined }), {
    state: 'not_applied', recommendedStayMin: 30, validSampleCount: 0, windowSampleCount: 0,
  });
});
