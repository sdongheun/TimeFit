import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const planner = fs.readFileSync('src/engine/planner.ts', 'utf-8');
const recommendationPolicy = fs.readFileSync('src/engine/recommendationPolicy.ts', 'utf-8');

test('도보는 실제 경로 재검증을 전제로 8분의 안전 여유를 확보한다', () => {
  assert.match(recommendationPolicy, /mode === 'walk'\) return 8/);
  assert.match(recommendationPolicy, /mode === 'transit'\) return 20/);
  assert.match(recommendationPolicy, /return 10/);
});

test('직행 대비 우회율은 추천 후보의 하드 제외 조건으로 사용하지 않는다', () => {
  assert.doesNotMatch(planner, /HARD_DETOUR_RATIO|directionEfficiency|detourRatio/);
  assert.match(planner, /firstFeasibleMode\(\[spot\], input\.origin, target, input\.remainingMin, candidateModes\)/);
});

test('지도 우선 후보는 단일 대중교통 기준이 아니라 세 수단 중 가능한 수단 하나로 통과시킨다', () => {
  assert.match(planner, /function normalizedCandidateModes/);
  assert.match(planner, /function firstFeasibleMode/);
  assert.match(planner, /remainingMin - safetyBufferMin\(mode\)/);
  assert.match(planner, /const onwardMode = automaticLegMode\(current, target\)/);
  assert.match(planner, /ResultsScreen과 동일한 자동 수단으로 계산한다/);
  assert.match(planner, /candidateModes\.length === 1/);
});

test('추가 이동은 전체 자투리 예산 대비 비중으로만 랭킹에 반영한다', () => {
  assert.match(planner, /function routeMovementOverhead/);
  assert.match(planner, /addedMove \/ Math\.max\(budget, 1\)/);
  assert.match(planner, /movement\.addedShare \* 0\.14/);
});
