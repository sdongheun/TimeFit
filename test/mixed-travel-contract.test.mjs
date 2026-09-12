import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const mixedTravel = fs.readFileSync('src/engine/mixedTravel.ts', 'utf-8');
const travel = fs.readFileSync('src/engine/travel.ts', 'utf-8');
const results = fs.readFileSync('src/ui/OneStopResultsScreen.tsx', 'utf-8');
const basketPlanner = fs.readFileSync('src/ui/recommendation/basketPlanner.ts', 'utf-8');
const execution = fs.readFileSync('src/ui/ExecutionScreen.tsx', 'utf-8');
const executionSchedule = fs.readFileSync('src/ui/execution/schedule.ts', 'utf-8');
const repository = fs.readFileSync('src/services/courseRepository.ts', 'utf-8');

test('자동 혼합 이동은 가까운 구간을 도보, 먼 구간을 대중교통으로 정한다', () => {
  assert.match(mixedTravel, /AUTO_WALK_LIMIT_MIN = 14/);
  assert.match(mixedTravel, /<= AUTO_WALK_LIMIT_MIN \? 'walk' : 'transit'/);
  assert.match(mixedTravel, /automaticTravelLegs/);
});

test('짧은 구간 근사에서 차량 시간을 도보 시간으로 재사용하지 않는다', () => {
  assert.match(travel, /mode === 'transit' && km < 0\.8 \? MODE\.walk : MODE\[mode\]/);
  assert.match(travel, /if \(km < 0\.03\) return 0/);
});

test('단일 장소 확정은 자동 선택한 이동수단으로 경로·운영시간을 다시 검증한다', () => {
  assert.match(results, /buildBasketCourse\(\[spot\], origin, target, ctx, \{ \[spot\.contentId\]: active\.mode \}, \{ finalMode: active\.mode \}\)/);
  assert.match(results, /validateCourseOpening\(\[spot\], origin, target, \[active\.mode, active\.mode\]/);
  assert.match(basketPlanner, /mode: travel\.mode/);
  assert.match(basketPlanner, /automaticTravelLegs\(selected, origin, target, arrivalModes\)/);
});

test('장소 상세는 자동 수단의 이동·체류·여유를 표시하고, 사용자 수단 선택을 요구하지 않는다', () => {
  assert.match(results, /approachMin=\{active\.approachMin\}/);
  assert.match(results, /onwardMin=\{active\.onwardMin\}/);
  assert.match(results, /최소/);
  assert.match(results, /권장/);
  assert.match(results, /TimeJourney/);
  assert.match(results, /journeyOf/);
  assert.doesNotMatch(results, /openTransportPicker|selectedArrivalModes|modePicker/);
});

test('저장과 실행은 각 이동 구간의 mode를 유지한다', () => {
  assert.match(repository, /mode: leg\.mode \?\? ctx\.mode/);
  assert.match(executionSchedule, /incomingMode: leg\.mode \?\? ctx\.mode/);
  assert.match(execution, /next\.incomingMode \?\? ctx\.mode/);
});
