import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const mixedTravel = fs.readFileSync('src/engine/mixedTravel.ts', 'utf-8');
const travel = fs.readFileSync('src/engine/travel.ts', 'utf-8');
const results = fs.readFileSync('src/ui/PlaceDetailScreen.tsx', 'utf-8');
const execution = fs.readFileSync('src/ui/CourseConfirmScreen.tsx', 'utf-8');
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

test('현재 확인은 검증 snapshot을 소비하고 invalid 입력을 차단하며 재계산하지 않는다', () => {
  assert.match(execution, /buildCourseV1DetailModel\(course, session/);
  assert.match(execution, /if \(!detail \|\| !steps\) return/);
  assert.doesNotMatch(execution, /buildBasketCourse|validateCourseOpening|planTimeFit/);
});

test('현재 장소 상세는 선택·운영시간을 표시하고 이동 구간은 코스 확인으로 분리한다', () => {
  assert.match(results, /testID="place-detail-hours"/);
  assert.match(results, /testID="place-detail-select"/);
  assert.match(execution, /CourseV1VerticalDetail/);
  assert.doesNotMatch(results, /openTransportPicker|selectedArrivalModes|modePicker/);
});

test('저장과 실행은 각 이동 구간의 mode를 유지한다', () => {
  assert.match(repository, /mode: leg\.mode \?\? ctx\.mode/);
  assert.match(executionSchedule, /incomingMode: leg\.mode \?\? ctx\.mode/);
  assert.match(execution, /openKakaoRouteWithFallback\(stage, travel.mode/);
  const progress = fs.readFileSync('src/ui/recommendation/verifiedCourseProgressModel.ts', 'utf8');
  assert.match(progress, /mode: leg.mode/);
  assert.match(progress, /mode: lastLeg.mode/);
});
