import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import type { CourseV1ReleaseOneStopResult, CourseV1RouteAdapter } from '../../src/engine';
import {
  advanceRecommendationProgress,
  recommendationProgressItems,
  type RecommendationProgressStage,
} from '../../src/ui/recommendation/recommendationLoadingModel';
import { runRecommendationSession } from '../../src/ui/recommendation/v1Session';

const session = {
  nowIso: '2026-09-04T06:00:00.000Z',
  origin: { id: 'origin', label: '출발', lat: 35.1, lon: 129.0 },
  destination: null,
  remainingMin: 60,
  arrivalBufferMin: 10,
};
const emptyResult = {
  representativeCourse: null,
  alternativeCourses: [],
  resultState: 'no_representative_candidates',
  alternativeState: 'no_candidates',
  continuation: null,
  diagnostics: { newProviderAttemptCount: 0 },
} as unknown as CourseV1ReleaseOneStopResult;
const routes = { async getRoute() { return null; } } as CourseV1RouteAdapter;

test('URELEASEVISUAL01 failure-first: 네 loading 상태는 순서대로만 전진하고 complete 뒤 고정된다', () => {
  let stage: RecommendationProgressStage | null = null;
  stage = advanceRecommendationProgress(stage, 'input_ready');
  assert.equal(stage, 'input_ready');
  assert.equal(advanceRecommendationProgress(stage, 'verifying'), stage);
  stage = advanceRecommendationProgress(stage, 'route_port_ready');
  assert.equal(advanceRecommendationProgress(stage, 'input_ready'), stage);
  stage = advanceRecommendationProgress(stage, 'verifying');
  stage = advanceRecommendationProgress(stage, 'complete');
  assert.equal(advanceRecommendationProgress(stage, 'verifying'), 'complete');
  assert.deepEqual(recommendationProgressItems('route_port_ready').map(({ state }) => state), ['done', 'current', 'pending', 'pending']);
});

test('URELEASEVISUAL01 failure-first: runtime은 실제 port와 builder 경계에서 네 callback을 한 번씩 낸다', async () => {
  const events: string[] = [];
  const result = await runRecommendationSession(session, {
    routeProxyEnabled: false,
    onProgress: (stage) => events.push(`progress:${stage}`),
  }, {
    createLegacyRoutes: () => { events.push('route-port'); return routes; },
    getPublicRecommendationEnvironment: () => ({ diagnostics: 'false', internalB12: 'false' }),
    buildRelease: async () => { events.push('builder'); return emptyResult; },
  });
  assert.equal(result, emptyResult);
  assert.deepEqual(events, [
    'progress:input_ready',
    'route-port',
    'progress:route_port_ready',
    'progress:verifying',
    'builder',
    'progress:complete',
  ]);
});

test('URELEASEVISUAL01 failure-first: 실패와 callback 오류는 complete·추가 호출을 만들지 않는다', async () => {
  const failedStages: RecommendationProgressStage[] = [];
  let routeCalls = 0;
  let builderCalls = 0;
  await assert.rejects(() => runRecommendationSession(session, {
    routeProxyEnabled: false,
    onProgress: (stage) => failedStages.push(stage),
  }, {
    createLegacyRoutes: () => { routeCalls += 1; return routes; },
    getPublicRecommendationEnvironment: () => ({ diagnostics: 'false', internalB12: 'false' }),
    buildRelease: async () => { builderCalls += 1; throw new Error('fixture failure'); },
  }));
  assert.deepEqual(failedStages, ['input_ready', 'route_port_ready', 'verifying']);
  assert.deepEqual([routeCalls, builderCalls], [1, 1]);

  const received = await runRecommendationSession(session, {
    routeProxyEnabled: false,
    onProgress: () => { throw new Error('display callback must be optional'); },
  }, {
    createLegacyRoutes: () => routes,
    getPublicRecommendationEnvironment: () => ({ diagnostics: 'false', internalB12: 'false' }),
    buildRelease: async () => emptyResult,
  });
  assert.equal(received, emptyResult);
});

test('URELEASEVISUAL01 failure-first: loading UI는 runtime callback만 쓰고 장식 timer가 없다', () => {
  const setup = fs.readFileSync('src/ui/TimeSetupScreen.tsx', 'utf8');
  assert.doesNotMatch(setup, /setLoadingStep\(1\);\s*setLoadingStep\(2\)/);
  assert.doesNotMatch(setup, /setTimeout\(resolve/);
  assert.match(setup, /onProgress:/);
  assert.match(setup, /RecommendationLoadingProgress/);
});

test('URELEASEVISUAL01 failure-first: 허용 화면의 시각 밀도와 비시각 spacer 계약을 지킨다', () => {
  const home = fs.readFileSync('src/ui/HomeScreen.tsx', 'utf8');
  const setup = fs.readFileSync('src/ui/TimeSetupScreen.tsx', 'utf8');
  const card = fs.readFileSync('src/ui/recommendation/CourseV1SummaryCard.tsx', 'utf8');
  const confirm = fs.readFileSync('src/ui/CourseConfirmScreen.tsx', 'utf8');
  const detail = fs.readFileSync('src/ui/recommendation/CourseV1VerticalDetail.tsx', 'utf8');

  assert.match(home, /placeholder: \{ marginTop: 2[4-9]/);
  assert.match(home, /active: \{ marginTop: 2[4-9]/);
  assert.match(card, /media: \{ height: 1(?:0[8-9]|1\d|20)/);
  assert.match(card, /content: \{ padding: 1[4-6]/);
  assert.match(card, /accessibilityLabel=\{summary\.accessibilityLabel\}/);
  assert.match(card, /onPress=\{onPress\}/);
  assert.match(confirm, /mapFrame: \{[^}]*height: 2[6-9]\d[^}]*marginHorizontal: -22/);
  assert.match(confirm, /segments=\{routeGeometry\.segments\}/);
  assert.match(confirm, /testID="verified-course-start"/);
  assert.match(detail, /guide/);
  assert.match(detail, /endpointDot/);
  assert.match(detail, /moveDot/);
  assert.match(detail, /stopDot/);
  assert.match(detail, /bufferDot/);

  for (const source of [setup, confirm]) {
    assert.match(source, /accessible=\{false\}[^>]*style=\{s\.headerSpacer\}/);
    assert.match(source, /headerSpacer: \{ width: 42, height: 42 \}/);
  }
  assert.doesNotMatch(`${setup}\n${confirm}`, /<View style=\{s\.(?:back|icon)\} \/>/);
});
