import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const mixedTravel = fs.readFileSync('src/engine/mixedTravel.ts', 'utf-8');
const results = fs.readFileSync('src/ui/ResultsScreen.tsx', 'utf-8');
const execution = fs.readFileSync('src/ui/ExecutionScreen.tsx', 'utf-8');
const repository = fs.readFileSync('src/services/courseRepository.ts', 'utf-8');

test('자동 혼합 이동은 가까운 구간을 도보, 먼 구간을 대중교통으로 정한다', () => {
  assert.match(mixedTravel, /AUTO_WALK_LIMIT_MIN = 14/);
  assert.match(mixedTravel, /<= AUTO_WALK_LIMIT_MIN \? 'walk' : 'transit'/);
  assert.match(mixedTravel, /automaticTravelLegs/);
});

test('장바구니 확정은 구간별 수단으로 정밀 경로·운영시간을 검증한다', () => {
  assert.match(results, /selectedArrivalModes/);
  assert.match(results, /automaticTravelLegs\(selected, origin, target, selectedArrivalModes\)/);
  assert.match(results, /plans\.map\(\(plan\) => plan\.mode/);
  assert.match(results, /mode: travel\.mode/);
  assert.match(results, /validateCourseOpening\([\s\S]*plans\.map\(\(plan\) => plan\.mode\)/);
});

test('장소 미리보기는 경로와 남은 시간을 먼저 보여주고, 수단 변경은 구간 단위로 제공한다', () => {
  assert.match(results, /openTransportPicker/);
  assert.match(results, /transportScenario/);
  assert.match(results, /routePreview/);
  assert.match(results, /약속 전 여유/);
  assert.match(results, /이곳 체류 가능/);
  assert.match(results, /compactModePicker/);
  assert.match(results, /장바구니에 담기/);
  assert.match(results, /addSpotWithTransport/);
  assert.match(results, /const approaches = trial\.map/);
  assert.match(results, /travelMin\(leg\.from, leg\.to, leg\.mode\)/);
  assert.match(mixedTravel, /arrivalModes\[spot\.contentId\]/);
  assert.match(mixedTravel, /마지막 약속 장소\(또는 복귀 지점\) 구간은 별도 선택 전까지 자동 추천/);
});

test('저장과 실행은 각 이동 구간의 mode를 유지한다', () => {
  assert.match(repository, /mode: leg\.mode \?\? ctx\.mode/);
  assert.match(execution, /incomingMode: lg\.mode \?\? ctx\.mode/);
  assert.match(execution, /next\.incomingMode \?\? ctx\.mode/);
});
