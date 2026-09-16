import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createRequire } from 'node:module';
import 'tsx/cjs';
import { confirmFixture, course, session, settle } from './ui/fixtures/currentConfirm.mjs';

const require = createRequire(import.meta.url);
const route = require('../src/ui/execution/schedule.ts');
const { buildVerifiedCourseProgressSteps } = require('../src/ui/recommendation/verifiedCourseProgressModel.ts');

const mixedTravel = fs.readFileSync('src/engine/mixedTravel.ts', 'utf-8');
const travel = fs.readFileSync('src/engine/travel.ts', 'utf-8');
const results = fs.readFileSync('src/ui/PlaceDetailScreen.tsx', 'utf-8');
const execution = fs.readFileSync('src/ui/CourseConfirmScreen.tsx', 'utf-8');

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

test('현재 진행 모델과 코스 확인은 각 이동 구간의 mode와 타깃을 카카오에 전달한다', async () => {
  assert.match(execution, /openKakaoRouteWithFallback\(stage, travel.mode/);
  const progress = fs.readFileSync('src/ui/recommendation/verifiedCourseProgressModel.ts', 'utf8');
  assert.match(progress, /mode: leg.mode/);
  assert.match(progress, /mode: lastLeg.mode/);
  // Both directions prevent a global/default mode from replacing an individual leg.
  for (const modes of [['walk', 'transit', 'walk'], ['transit', 'walk', 'transit']]) {
    const value = course(['A', 'B']);
    value.legs = value.legs.map((leg, index) => ({ ...leg, mode: modes[index] }));
    const points = ['A', 'B'].map((id, index) => ({ id, label: `긴 장소 이름 ${id}`, lat: 35.13 + index * .01, lon: 129.13 + index * .01 }));
    const steps = buildVerifiedCourseProgressSteps(value, session.origin, session.destination, id => points.find(point => point.id === id));
    assert.ok(steps);
    const travels = steps.filter(step => step.kind === 'travel');
    assert.deepEqual(travels.map(step => step.mode), modes);
    assert.deepEqual(travels.map(step => [step.from.id, step.target.id, step.isFinal]), [['origin', 'A', false], ['A', 'B', false], ['B', 'destination', true]]);
    const received = [];
    const f = confirmFixture(value, { './execution/schedule': {
      ...route,
      async openKakaoRouteWithFallback(stage, mode) {
        received.push({ stage, mode });
        // Direct KakaoRouteTarget fixture; no removed schedule builder or native API.
        return route.openKakaoRouteWithFallback(stage, mode, {
          async canOpenApp() { return true; },
          async openApp(url) {
            const parsed = new URL(url);
            assert.equal(parsed.searchParams.get('by'), mode === 'walk' ? 'foot' : 'publictransit');
            assert.equal(parsed.searchParams.get('sp'), `${stage.from.point.lat},${stage.from.point.lon}`);
            assert.equal(parsed.searchParams.get('ep'), `${stage.to.point.lat},${stage.to.point.lon}`);
          },
          async openWeb() { assert.fail('installed fixture must not fall back'); },
          async openBrowser() { assert.fail('installed fixture must not open browser'); },
        });
      },
    } });
    try {
      f.screen.press('verified-course-start');
      for (let index = 0; index < travels.length; index += 1) {
        // Inject the existing active travel state to isolate each handoff boundary.
        f.flow.activeVerifiedCourse = { ...f.flow.activeVerifiedCourse, progress: { stepIndex: index * 2, routeOpened: false, finished: false } };
        f.screen.render();
        f.screen.press('verified-progress-primary');
        for (let turn = 0; turn < 6; turn += 1) await settle();
        assert.equal(received.length, index + 1);
        assert.equal(received[index].mode, modes[index]);
        for (const [side, point] of [['from', travels[index].from], ['to', travels[index].target]]) {
          assert.equal(received[index].stage[side].name, point.label);
          assert.equal(received[index].stage[side].point.lat, point.lat);
          assert.equal(received[index].stage[side].point.lon, point.lon);
        }
        assert.equal(f.flow.activeVerifiedCourse.progress.routeOpened, true);
      }
    } finally { f.screen.unmount(); }
  }
});
