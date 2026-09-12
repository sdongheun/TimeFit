import assert from 'node:assert/strict';
import test from 'node:test';
import type { RecommendationSession } from '../../src/ui/nav';
import { buildReleaseOneStopRepresentativeCourseV1, type CourseV1Candidate, type CourseV1RouteReceiptAdapter } from '../../src/engine/courseV1';
import { captureRecommendationNowIso, startMinuteForRecommendation } from '../../src/ui/recommendation/recommendationSessionTime';
import { runRecommendationSession, requestConditionalManualCourse } from '../../src/ui/recommendation/v1Session';
import { buildCourseV1DetailModel } from '../../src/ui/recommendation/courseV1CardDetailModel';
import { isConditionalManualConfirmTime } from '../../src/ui/recommendation/verifiedCourseResultsModel';
import { buildQaReleaseOneStopSession, qaReleaseOneStopLauncherEnabled } from '../../src/ui/qaReleaseOneStopLauncherModel';
import { releaseTimeSetupValidation } from '../../src/ui/timeSetup/releaseTimeBoundary';
import { resolveTimeSetupClock, suggestedEndForTestClock } from '../../src/ui/timeSetup/testClock';

// Diagnosis: explicit KST fixtures, no global Date replacement, network or DB calls.
const date = (time: string, day = '08') => new Date(`2026-09-${day}T${time}:00+09:00`);
const place: CourseV1Candidate = { id: 'clock-place', title: '고정 문화시설', lat: 35.151, lon: 129.061,
  classification: 'representative_standard', minStayMin: 20, recommendedStayMin: 30, maxStayMin: 60,
  availability: { status: 'structured', alwaysAccessible: false, dayTypes: ['weekday', 'weekend'], windows: [{ startMin: 840, endMin: 1080 }] } };
const sessionAt = (actual: Date, testMinute: number | null = 900) => ({
  nowIso: captureRecommendationNowIso(actual, testMinute),
  origin: { id: 'origin', label: '고정 출발', lat: 35.15, lon: 129.06 }, destination: null,
  remainingMin: 120, arrivalBufferMin: 10,
});
async function run(session: RecommendationSession, response: 'exact' | 'no_route' | 'unavailable' = 'exact') {
  const observedTimes: string[] = [];
  const ports: CourseV1RouteReceiptAdapter & { getRoute: () => Promise<null> } = {
    getRoute: async () => null,
    getRouteReceipt: async () => response === 'exact'
      ? { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false }
      : { result: response, newProviderAttemptCount: 1, reused: false },
  };
  const result = await runRecommendationSession(session, { routeProxyEnabled: true }, {
    createLegacyRoutes: () => { throw new Error('fixture must not fall back to legacy'); },
    createActivatedProxyRoutes: async () => ports,
    getPublicRecommendationEnvironment: () => ({}),
    buildRelease: input => buildReleaseOneStopRepresentativeCourseV1({ ...input, provider: {
      listRepresentativeCandidates: now => { observedTimes.push(now.toISOString()); return [place]; },
    } }),
  });
  return { result, observedTimes };
}

test('CLOCK-DIAG: actual 02/20, manual and QA 15:00 both reach real engine/provider and CourseConfirm display', async () => {
  for (const actual of [date('02:00'), date('20:00')]) {
    const manual = sessionAt(actual);
    const qa = buildQaReleaseOneStopSession('SIM-ONE-02', actual);
    for (const session of [manual, qa]) {
      assert.equal(startMinuteForRecommendation(session.nowIso), 900);
      assert.equal(releaseTimeSetupValidation(true, session.remainingMin), '');
      const { result, observedTimes } = await run(session);
      assert.deepEqual(observedTimes, [session.nowIso]);
      assert.ok(result.representativeCourse);
      assert.equal(new Date(result.representativeCourse.stops[0].arrivalAt).getHours(), 15);
      const serialized = JSON.parse(JSON.stringify({ session, course: result.representativeCourse }));
      assert.ok(buildCourseV1DetailModel(serialized.course, serialized.session, () => ({ ...place, category: '문화시설' })));
    }
    assert.equal(isConditionalManualConfirmTime(actual), false);
    const real = await run(sessionAt(actual, null));
    assert.equal(real.result.representativeCourse, null, '14–18 structured fixture is closed on actual clock');
  }
});

test('CLOCK-DIAG: identical 15:00 input distinguishes exact success from no-route and unavailable', async () => {
  for (const response of ['exact', 'no_route', 'unavailable'] as const) {
    const { result, observedTimes } = await run(sessionAt(date('02:00')), response);
    assert.equal(observedTimes[0], captureRecommendationNowIso(date('02:00'), 900));
    assert.equal(Boolean(result.representativeCourse), response === 'exact');
  }
});

test('CLOCK-DIAG observed limitation: conditional confirmation subtracts test/actual offset, not real waiting duration', async () => {
  for (const [actual, expected] of [[date('17:00'), 0], [date('10:00'), 120]] as const) {
    const session = sessionAt(actual);
    await run(session);
    assert.equal(isConditionalManualConfirmTime(actual), true);
    let budget: number | undefined;
    await requestConditionalManualCourse(session, 'fixture-market', actual, { buildConditionalManual: async input => {
      budget = input.remainingMin;
      assert.equal(input.now, actual);
      return { state: 'rejected', reason: 'time_budget_exceeded', receipt: { adapterCallCount: 0, newProviderAttemptCount: 0, cacheOrSessionReuseCount: 0 } };
    } });
    // Locks current defect evidence, NOT the desired post-fix expectation.
    assert.equal(budget, expected);
  }
});

test('CLOCK-DIAG → URELEASE180: 120 fixture retained, 180 bound and next-day offset replace 23xx clamp', () => {
  assert.equal(suggestedEndForTestClock(900), 1080);
  assert.equal(releaseTimeSetupValidation(true, 120), '');
  assert.equal(releaseTimeSetupValidation(true, 121), '');
  assert.ok(releaseTimeSetupValidation(true, 181));
  assert.equal(suggestedEndForTestClock(1410), 1590);
  assert.equal(releaseTimeSetupValidation(true, 29), '');
  assert.ok(releaseTimeSetupValidation(true, 60 - 1410));
  const actual = { nowMin: 120, dayType: '평일' as const, hourBucket: '야간' as const };
  assert.equal(resolveTimeSetupClock(actual, 900).nowMin, 900);
  assert.deepEqual(resolveTimeSetupClock(actual, null), actual);
  assert.equal(captureRecommendationNowIso(date('02:00'), null), date('02:00').toISOString());
  assert.equal(qaReleaseOneStopLauncherEnabled(false, 'true'), false);
});

test('CLOCK-DIAG: CAPTCHA date crossing exposes manual post-verification versus QA pre-verification capture', () => {
  const before = date('23:59');
  const after = date('00:01', '09');
  const qaPendingSession = buildQaReleaseOneStopSession('SIM-ONE-02', before);
  const manualAfterVerification = sessionAt(after);
  assert.equal(qaPendingSession.nowIso, date('15:00').toISOString());
  assert.equal(manualAfterVerification.nowIso, date('15:00', '09').toISOString());
  assert.equal(startMinuteForRecommendation(manualAfterVerification.nowIso), 900);
  assert.equal(qaPendingSession.remainingMin, 120);
});
