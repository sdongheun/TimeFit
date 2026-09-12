import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import type { CourseV1ReleaseOneStopResult, VerifiedCourseV1 } from '../../src/engine';
import {
  QA_RELEASE_ONE_STOP_PREFIX,
  QA_RELEASE_ONE_STOP_SCENARIOS,
  buildQaReleaseOneStopReceipt,
  buildQaReleaseOneStopSession,
  createQaReleaseOneStopRunController,
  nextQaReleaseOneStopScenarioId,
  qaReleaseOneStopLauncherEnabled,
  qaReleaseOneStopReceiptLine,
} from '../../src/ui/qaReleaseOneStopLauncherModel';

const course = (placeId: string): VerifiedCourseV1 => ({
  id: `course-${placeId}`,
  placeIds: [placeId],
  legs: [
    { fromId: 'origin', toId: placeId, mode: 'walk', min: 10 },
    { fromId: placeId, toId: 'origin', mode: 'walk', min: 10 },
  ],
  stops: [{ placeId, arrivalAt: '2026-09-02T06:10:00.000Z', departureAt: '2026-09-02T06:40:00.000Z', stayMin: 30, stayState: 'recommended', availabilityState: 'structured_verified' }],
  stayMin: 30,
  travelMin: 20,
  totalMin: 60,
  arrivalBufferMin: 10,
  remainingAfterCourseMin: 10,
  remainingAfterArrivalBufferMin: 10,
});

const result = (representativeCourse: VerifiedCourseV1 | null, alternativeCourses: readonly VerifiedCourseV1[] = []): CourseV1ReleaseOneStopResult => ({
  representativeCourse,
  alternativeCourses,
  resultState: representativeCourse ? 'verified' : 'no_verified_course_within_limit',
  alternativeState: alternativeCourses.length ? 'alternatives_available' : 'no_alternative_verified_course',
  diagnostics: {
    providerCandidateCount: 8,
    preselectionCandidateCount: 7,
    candidatePoolCount: 6,
    generatedOrderedCourseCount: 4,
    preselectedCourseIds: [],
    exactCourseAttemptCount: 4,
    routeRejected: 1,
    openingRejected: 0,
    budgetRejected: 1,
    relationshipRejected: 0,
    classificationExcluded: 1,
    newProviderAttemptCount: 4,
    adapterCallCount: 6,
    cacheOrSessionReuseCount: 2,
    outcomeReasonCounts: { route_not_verified: 1, time_budget_exceeded: 1 },
  },
});

test('UQAHARNESS01: launcher와 receipt는 dev+exact diagnostics에서만 노출된다', () => {
  assert.equal(qaReleaseOneStopLauncherEnabled(true, 'true'), true);
  for (const [dev, diagnostics] of [[false, 'true'], [true, 'false'], [true, undefined], [true, 'TRUE']] as const) {
    assert.equal(qaReleaseOneStopLauncherEnabled(dev, diagnostics), false);
    assert.equal(qaReleaseOneStopReceiptLine(dev, diagnostics, buildQaReleaseOneStopReceipt('SIM-ONE-01', result(null))), null);
  }
  assert.match(qaReleaseOneStopReceiptLine(true, 'true', buildQaReleaseOneStopReceipt('SIM-ONE-01', result(null))) ?? '', /^\[qa-release-one-stop\] \{/);
});

test('UQAHARNESS01: 8개 고정 session은 15:00·여유 10분·1~120분과 왕복/편도를 정확히 직렬화한다', () => {
  assert.deepEqual(QA_RELEASE_ONE_STOP_SCENARIOS.map(({ id }) => id), Array.from({ length: 8 }, (_, index) => `SIM-ONE-${String(index + 1).padStart(2, '0')}`));
  assert.equal(new Set(QA_RELEASE_ONE_STOP_SCENARIOS.map(({ id }) => id)).size, 8);
  const capturedAt = new Date('2026-09-02T01:12:34.000Z');
  for (const scenario of QA_RELEASE_ONE_STOP_SCENARIOS) {
    const session = buildQaReleaseOneStopSession(scenario.id, capturedAt);
    assert.ok(session.remainingMin >= 1 && session.remainingMin <= 120);
    assert.equal(session.arrivalBufferMin, 10);
    assert.equal(typeof session.nowIso, 'string');
    assert.equal(new Date(session.nowIso).getHours(), 15);
    assert.ok(Number.isFinite(session.origin.lat) && Number.isFinite(session.origin.lon));
    if (scenario.destination) {
      assert.ok(session.destination);
      assert.notEqual(session.destination?.id, session.origin.id);
    } else assert.equal(session.destination, null);
    const serialized = JSON.stringify(session);
    assert.equal(JSON.parse(serialized).nowIso, session.nowIso);
    assert.doesNotMatch(serialized, /provider|adapter|function|captcha|token/i);
  }
});

test('UQAHARNESS01: 한 탭은 runner 한 번만 열고 중복·취소 뒤 늦은 CAPTCHA·stale 완료를 막는다', async () => {
  const controller = createQaReleaseOneStopRunController();
  const first = controller.select('SIM-ONE-01');
  assert.ok(first);
  assert.equal(controller.select('SIM-ONE-01'), null);
  let calls = 0;
  assert.equal(controller.beginRecommendation(first!), true);
  assert.equal(controller.beginRecommendation(first!), false);
  calls += 1;
  assert.equal(controller.finish(first!), true);
  assert.equal(calls, 1);
  assert.equal(nextQaReleaseOneStopScenarioId(controller.lastFinishedScenarioId()), 'SIM-ONE-02');

  const cancelled = controller.select('SIM-ONE-02')!;
  assert.equal(controller.cancel(cancelled), true);
  const newer = controller.select('SIM-ONE-03')!;
  assert.equal(controller.beginRecommendation(cancelled), false);
  assert.equal(controller.beginRecommendation(newer), true);
  assert.equal(controller.finish(cancelled), false);
  assert.equal(controller.finish(newer), true);
  assert.equal(controller.lastFinishedScenarioId(), 'SIM-ONE-03');
});

test('UQAHARNESS01: verified·empty·failed receipt는 집계만 한 줄로 남기고 좌표·token·URL·사용자 정보를 버린다', () => {
  const verified = buildQaReleaseOneStopReceipt('SIM-ONE-03', result(course('place-a'), [course('35.1578,129.0594')]), (id) => id === 'place-a' ? '대표 장소' : 'https://secret.invalid/?token=abc');
  const line = qaReleaseOneStopReceiptLine(true, 'true', verified)!;
  assert.equal(verified.status, 'verified');
  assert.deepEqual(verified.coursePlaceCounts, [1, 1]);
  assert.deepEqual(verified.rejectionCounts, { route: 1, opening: 0, budget: 1, relationship: 0, classification: 1 });
  assert.equal(verified.representative?.name, '대표 장소');
  assert.equal(verified.alternatives[0]?.placeId, null);
  assert.equal(verified.alternatives[0]?.name, null);
  assert.match(line, new RegExp(`^\\${QA_RELEASE_ONE_STOP_PREFIX}`));
  assert.doesNotMatch(line, /35\.|129\.|token|jwt|supabase|user[_-]?id|https?:|secret/i);
  assert.equal(line.split('\n').length, 1);

  const empty = buildQaReleaseOneStopReceipt('SIM-ONE-04', result(null));
  assert.equal(empty.status, 'empty');
  assert.equal(empty.representative, null);
  const failed = buildQaReleaseOneStopReceipt('SIM-ONE-05', null, undefined, { reason: 'route_proxy_store_unavailable', token: 'secret', url: 'https://secret.invalid', lat: 35.1 });
  assert.equal(failed.status, 'failed');
  assert.equal(failed.failure, 'route_proxy_store_unavailable');
  assert.doesNotMatch(JSON.stringify(failed), /secret|https?:|35\.1|"(?:token|jwt|url|lat|lon|userId)":/);
});

test('UQAHARNESS01: TimeSetup은 기존 gate·runner를 공유하고 일반 입력과 QA launcher 복귀 경로를 남긴다', () => {
  const source = fs.readFileSync('src/ui/TimeSetupScreen.tsx', 'utf-8');
  const nav = fs.readFileSync('src/ui/nav.ts', 'utf-8');
  assert.match(source, /qaLauncherEnabled \? <Pressable testID="qa-release-one-stop-launcher"/);
  assert.match(source, /testID=\{`qa-scenario-\$\{scenario\.id\}`\}/);
  assert.match(source, /recommendationGateDecision\(/);
  assert.match(source, /const executeRecommendation = async/);
  assert.equal(source.match(/runRecommendationSession\(/g)?.length, 1);
  assert.match(source, /navigation\.navigate\('Results', params\)/);
  assert.doesNotMatch(source, /navigation\.replace\('Results', params\)/);
  assert.match(source, /if \(line\) console\.info\(line\)/);
  assert.doesNotMatch(nav, /QaRelease|QA_RELEASE|qa-launcher/);
});
