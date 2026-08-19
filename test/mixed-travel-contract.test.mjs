import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const mixedTravel = fs.readFileSync('src/engine/mixedTravel.ts', 'utf-8');
const travel = fs.readFileSync('src/engine/travel.ts', 'utf-8');
const results = fs.readFileSync('src/ui/ResultsScreen.tsx', 'utf-8');
const basketPlanner = fs.readFileSync('src/ui/recommendation/basketPlanner.ts', 'utf-8');
const candidateDetail = fs.readFileSync('src/ui/recommendation/CandidateDetail.tsx', 'utf-8');
const candidateEvaluation = fs.readFileSync('src/ui/recommendation/candidateEvaluation.ts', 'utf-8');
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

test('장바구니 확정은 구간별 수단으로 정밀 경로·운영시간을 검증한다', () => {
  assert.match(results, /selectedArrivalModes/);
  assert.match(results, /automaticTravelLegs\(selected, origin, target, selectedArrivalModes\)/);
  assert.match(results, /plans\.map\(\(plan\) => plan\.mode/);
  assert.match(results, /buildBasketCourse\(selected, origin, target, ctx, selectedArrivalModes\)/);
  assert.match(basketPlanner, /mode: travel\.mode/);
  assert.match(basketPlanner, /automaticTravelLegs\(selected, origin, target, arrivalModes\)/);
  assert.match(results, /validateCourseOpening\([\s\S]*plans\.map\(\(plan\) => plan\.mode\)/);
});

test('장소 미리보기는 경로와 남은 시간을 먼저 보여주고, 수단 변경은 구간 단위로 제공한다', () => {
  assert.match(results, /openTransportPicker/);
  assert.match(results, /transportScenario/);
  assert.match(candidateDetail, /routePreview/);
  assert.match(candidateDetail, /move:/);
  assert.match(candidateDetail, /stay:/);
  assert.match(candidateDetail, /remaining:/);
  assert.match(candidateDetail, /남는 시간/);
  assert.match(candidateDetail, /코스 체류/);
  assert.match(candidateDetail, /총 이동/);
  assert.match(candidateDetail, /totalMoveMin/);
  assert.match(candidateDetail, /totalStayMin/);
  assert.match(candidateDetail, /remainingAfterPlannedMin/);
  assert.match(candidateDetail, /modePicker/);
  assert.match(candidateDetail, /장바구니에 담기/);
  assert.match(results, /addSpotWithTransport/);
  assert.match(candidateEvaluation, /const approaches = trial\.map/);
  assert.match(candidateEvaluation, /travelMin\(leg\.from, leg\.to, leg\.mode\)/);
  assert.match(mixedTravel, /arrivalModes\[spot\.contentId\]/);
  assert.match(mixedTravel, /마지막 약속 장소\(또는 복귀 지점\) 구간은 별도 선택 전까지 자동 추천/);
});

test('저장과 실행은 각 이동 구간의 mode를 유지한다', () => {
  assert.match(repository, /mode: leg\.mode \?\? ctx\.mode/);
  assert.match(executionSchedule, /incomingMode: leg\.mode \?\? ctx\.mode/);
  assert.match(execution, /next\.incomingMode \?\? ctx\.mode/);
});
