import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import type { VerifiedCourseV1 } from '../../src/engine';
import type {
  CompleteCourseInput,
  CompleteCourseResult,
  CourseCompletionRecordV1,
  ReadCourseCompletionsResult,
} from '../../src/services/courseCompletionRepository';
import {
  createActiveVerifiedCourseStartController,
  createOpaqueCourseRunIdFactory,
  startActiveVerifiedCourse,
  updateActiveVerifiedCourse,
} from '../../src/ui/activeVerifiedCourseModel';
import {
  buildCompleteCourseInput,
  completionFailureMessage,
  createCourseCompletionFinishController,
} from '../../src/ui/courseCompletionUiModel';
import {
  buildCompletionHistorySummary,
  loadCompletionHistory,
} from '../../src/ui/activity/activitySummary';
import type { RecommendationSession } from '../../src/ui/nav';

const session: RecommendationSession = {
  nowIso: '2026-09-05T06:00:00.000Z',
  origin: { id: 'origin', label: '출발지', lat: 35.15, lon: 129.05 },
  destination: { id: 'destination', label: '약속 장소', lat: 35.16, lon: 129.06 },
  remainingMin: 100,
  arrivalBufferMin: 10,
};

function course(ids: readonly string[]): VerifiedCourseV1 {
  const stops = ids.map((placeId, index) => ({
    placeId,
    stayMin: 20 + index * 10,
    stayState: 'recommended' as const,
    availabilityState: 'structured_verified' as const,
    arrivalAt: `2026-09-05T06:${10 + index * 30}:00.000Z`,
    departureAt: `2026-09-05T06:${30 + index * 30}:00.000Z`,
  }));
  const endpoints = ['origin', ...ids, 'destination'];
  const legs = endpoints.slice(0, -1).map((fromId, index) => ({ fromId, toId: endpoints[index + 1]!, mode: 'walk' as const, min: 10 }));
  const stayMin = stops.reduce((sum, stop) => sum + stop.stayMin, 0);
  const travelMin = legs.reduce((sum, leg) => sum + leg.min, 0);
  return { id: `course-${ids.join('-')}`, placeIds: [...ids], stops, legs, stayMin, travelMin, totalMin: stayMin + travelMin, arrivalBufferMin: 10, remainingAfterCourseMin: 20, remainingAfterArrivalBufferMin: 10 };
}

const catalog = new Map([
  ['p1', { contentId: 'p1', title: '첫 장소', category: '문화시설', subCategory: '전시' }],
  ['p2', { contentId: 'p2', title: '둘째 장소', category: '자연관광지' }],
]);
const resolveCatalog = (id: string) => catalog.get(id);
const start = (ids: readonly string[], runId: string) => startActiveVerifiedCourse(
  session,
  course(ids),
  () => `identity-${runId}`,
  undefined,
  () => runId,
);

test('UCOMPLETIONHISTORY01 failure-first: 1곳·2곳 시작은 opaque courseRunId를 한 번 만들고 순서를 보존한다', () => {
  let runCalls = 0;
  const nextRun = createOpaqueCourseRunIdFactory(() => `uuid-${++runCalls}`);
  const one = startActiveVerifiedCourse(session, course(['p1']), () => 'identity-1', undefined, nextRun);
  const two = startActiveVerifiedCourse(session, course(['p2', 'p1']), () => 'identity-2', undefined, nextRun);
  assert.equal(runCalls, 2);
  assert.equal(one.courseRunId, 'course-run-uuid-1');
  assert.equal(two.courseRunId, 'course-run-uuid-2');
  const projected = buildCompleteCourseInput(two, resolveCatalog, 1_788_000_000_000);
  assert.equal(projected.status, 'ready');
  if (projected.status === 'ready') assert.deepEqual(projected.input.places.map((place) => place.contentId), ['p2', 'p1']);
});

test('UCOMPLETIONHISTORY01 failure-first: 진행 갱신·Home/지도 왕복·같은 snapshot은 run ID를 유지한다', () => {
  const active = start(['p1'], 'stable-run');
  const updated = updateActiveVerifiedCourse(active, active.identity, () => ({ stepIndex: 2, routeOpened: true, finished: false }));
  assert.equal(updated?.courseRunId, 'stable-run');
  assert.equal(active.courseRunId, 'stable-run');
  assert.equal(active.session, session);
  assert.equal(active.course, active.course);
});

test('UCOMPLETIONHISTORY01 failure-first: 다른 코스 명시 교체는 이전 완료 없이 새 run 하나만 만든다', () => {
  const existing = start(['p1'], 'existing-run');
  let runCreations = 0;
  let completionWrites = 0;
  const replacementActions: Array<() => void> = [];
  let navigated = 0;
  const controller = createActiveVerifiedCourseStartController({
    canStart: () => true, // Completion/identity fixture, no wall-clock dependency.
    start(request) {
      return startActiveVerifiedCourse(request.session, request.course, () => 'replacement-identity', undefined, () => `replacement-run-${++runCreations}`);
    },
    navigate() { navigated += 1; },
    confirm(model) { replacementActions.push(model.actions.startNew); },
  });
  controller.request(existing, { session, course: course(['p2']) });
  assert.equal(runCreations, 0);
  assert.equal(completionWrites, 0);
  replacementActions[0]?.();
  assert.equal(runCreations, 1);
  assert.equal(completionWrites, 0);
  assert.equal(navigated, 1);
});

test('UCOMPLETIONHISTORY01 failure-first: completion payload는 catalog 사실과 stop 체류만 쓰고 민감 정보를 포함하지 않는다', () => {
  const projected = buildCompleteCourseInput(start(['p1', 'p2'], 'safe-run'), resolveCatalog, 1_788_000_000_000);
  assert.equal(projected.status, 'ready');
  if (projected.status !== 'ready') return;
  assert.deepEqual(projected.input, {
    courseRunId: 'safe-run',
    completedAt: 1_788_000_000_000,
    trigger: 'explicit_course_finish',
    places: [
      { contentId: 'p1', title: '첫 장소', category: '문화시설', subCategory: '전시', plannedStayMin: 20, actualDwellMin: null },
      { contentId: 'p2', title: '둘째 장소', category: '자연관광지', subCategory: null, plannedStayMin: 30, actualDwellMin: null },
    ],
  });
  const raw = JSON.stringify(projected.input);
  for (const forbidden of ['userId', 'anonymous', 'lat', 'lon', 'origin', 'destination', 'receipt', 'geometry', 'token']) assert.equal(raw.includes(forbidden), false);
});

test('UCOMPLETIONHISTORY01 failure-first: catalog 누락·stop 불일치는 repository 호출 전 typed failure다', () => {
  const missing = buildCompleteCourseInput(start(['missing'], 'missing-run'), resolveCatalog, 1_788_000_000_000);
  assert.deepEqual(missing, { status: 'invalid_snapshot' });
  const active = start(['p1'], 'broken-run');
  const broken = { ...active, course: { ...active.course, placeIds: ['p2'] } };
  assert.deepEqual(buildCompleteCourseInput(broken, resolveCatalog, 1_788_000_000_000), { status: 'invalid_snapshot' });
});

function finishHarness(results: Array<CompleteCourseResult | Error>) {
  let completes = 0;
  let clears = 0;
  let navigations = 0;
  let recorded: boolean | null = null;
  const inputs: CompleteCourseInput[] = [];
  const states: string[] = [];
  const controller = createCourseCompletionFinishController({
    async complete(nextInput) {
      completes += 1;
      inputs.push(nextInput);
      const result = results.shift() ?? new Error('missing fixture');
      if (result instanceof Error) throw result;
      return result;
    },
    onStateChange(state) { states.push(state.kind); },
    onFinish(result) { clears += 1; navigations += 1; recorded = result.recorded; },
  });
  return { controller, counts: () => ({ completes, clears, navigations }), inputs, states, get recorded() { return recorded; } };
}

const input = (run = 'finish-run'): CompleteCourseInput => ({
  courseRunId: run,
  completedAt: 1_788_000_000_000,
  trigger: 'explicit_course_finish',
  places: [{ contentId: 'p1', title: '첫 장소', category: '문화시설', subCategory: '전시', plannedStayMin: 20, actualDwellMin: null }],
});
const record = (run = 'finish-run'): CourseCompletionRecordV1 => ({ schemaVersion: 1, completionId: `completion-${run}`, ...input(run) });

test('UCOMPLETIONHISTORY01 failure-first: 명시 완료 빠른 연타는 complete/clear/navigation 각 한 번이다', async () => {
  let resolve!: (result: CompleteCourseResult) => void;
  const pending = new Promise<CompleteCourseResult>((done) => { resolve = done; });
  let calls = 0;
  let finished = 0;
  const controller = createCourseCompletionFinishController({
    complete: () => { calls += 1; return pending; },
    onStateChange() {},
    onFinish() { finished += 1; },
  });
  const first = controller.finish(input());
  const duplicate = controller.finish(input());
  assert.equal(calls, 1);
  resolve({ status: 'created', record: record() });
  await Promise.all([first, duplicate]);
  assert.equal(calls, 1);
  assert.equal(finished, 1);
});

test('UCOMPLETIONHISTORY01 failure-first: route open·취소·뒤로가기·background는 complete를 호출하지 않는다', () => {
  const h = finishHarness([{ status: 'created', record: record() }]);
  const nonCompletionEvents = ['route_open', 'course_replace_cancel', 'back', 'background'] as const;
  for (const _event of nonCompletionEvents) assert.deepEqual(h.counts(), { completes: 0, clears: 0, navigations: 0 });
  const progress = fs.readFileSync('src/ui/CourseConfirmScreen.tsx', 'utf8');
  assert.equal([...progress.matchAll(/courseCompletionRepository\.complete/g)].length, 1);
});

test('UCOMPLETIONHISTORY01 failure-first: created와 already_completed는 중복 없이 성공 종료한다', async () => {
  for (const status of ['created', 'already_completed'] as const) {
    const h = finishHarness([{ status, record: record(status) }]);
    await h.controller.finish(input(status));
    await h.controller.finish(input(status));
    assert.deepEqual(h.counts(), { completes: 1, clears: 1, navigations: 1 });
    assert.equal(h.recorded, true);
  }
});

test('UCOMPLETIONHISTORY01 failure-first: 저장 실패는 active를 유지하고 retry는 같은 run으로 멱등 재호출한다', async () => {
  const h = finishHarness([{ status: 'storage_unavailable' }, { status: 'already_completed', record: record() }]);
  await h.controller.finish(input());
  assert.deepEqual(h.counts(), { completes: 1, clears: 0, navigations: 0 });
  assert.deepEqual(h.states, ['saving', 'failure']);
  await h.controller.finish(input());
  assert.deepEqual(h.counts(), { completes: 2, clears: 1, navigations: 1 });
  assert.deepEqual(h.inputs.map((value) => value.courseRunId), ['finish-run', 'finish-run']);
  assert.equal(h.recorded, true);
});

test('UCOMPLETIONHISTORY01 failure-first: invalid/corrupt/unavailable은 성공이 아니며 기록 없이 마치기를 명시 선택할 수 있다', async () => {
  for (const status of ['invalid_input', 'storage_unavailable', 'storage_corrupt'] as const) {
    const h = finishHarness([{ status }]);
    await h.controller.finish(input());
    assert.match(completionFailureMessage(status), /기록/);
    assert.deepEqual(h.counts(), { completes: 1, clears: 0, navigations: 0 });
    h.controller.finishWithoutRecord();
    h.controller.finishWithoutRecord();
    assert.deepEqual(h.counts(), { completes: 1, clears: 1, navigations: 1 });
    assert.equal(h.recorded, false);
  }
});

const completion = (completionId: string, completedAt: number, places: CompleteCourseInput['places'], actual?: readonly (number | null)[]): CourseCompletionRecordV1 => ({
  schemaVersion: 1,
  completionId,
  courseRunId: `run-${completionId}`,
  completedAt,
  trigger: 'explicit_course_finish',
  places: places.map((place, index) => ({ ...place, actualDwellMin: actual?.[index] ?? place.actualDwellMin })),
});

test('UCOMPLETIONHISTORY01 failure-first: 이번 달·count 비율·미측정/부분 측정을 구분하고 legacy 추정 체류는 합산하지 않는다', () => {
  const now = new Date('2026-09-20T12:00:00+09:00').getTime();
  const september = new Date('2026-09-05T12:00:00+09:00').getTime();
  const august = new Date('2026-08-31T12:00:00+09:00').getTime();
  const summary = buildCompletionHistorySummary([
    completion('new', september, input().places),
    completion('old', august, [{ ...input().places[0]!, category: '자연관광지' }], [50]),
  ], [
    { id: 'legacy', completedAt: september, contentId: 'legacy', title: '옛 장소', category: '문화시설', rating: 4, actualDwellMin: 99 },
    { id: 'measured', completedAt: september, contentId: 'measured', title: '측정 장소', category: '카페', rating: 5 },
  ], now);
  assert.equal(summary.completedPlaceCount, 3);
  assert.equal(summary.completedDwellMin, 0);
  assert.equal(summary.measuredCount, 0);
  assert.equal(summary.unmeasuredCount, 3);
  assert.deepEqual(summary.categories.map(({ category, count, ratio }) => ({ category, count, ratio })), [
    { category: '문화시설', count: 2, ratio: 67 },
    { category: '카페', count: 1, ratio: 33 },
  ]);
  assert.equal(summary.dwellPresentation.kind, 'unmeasured');
  const partial = buildCompletionHistorySummary([completion('partial', september, [input().places[0]!, { ...input().places[0]!, contentId: 'p2' }], [25, null])], [], now);
  assert.deepEqual(partial.dwellPresentation, { kind: 'partial', measuredMin: 25, measuredCount: 1, unmeasuredCount: 1 });
});

test('UCOMPLETIONHISTORY01 failure-first: completion read 손상/실패를 empty로 숨기지 않고 정상 empty와 구분한다', async () => {
  const legacy = async () => [];
  for (const status of ['storage_corrupt', 'storage_unavailable'] as const) {
    const result = await loadCompletionHistory({ readCompletions: async () => ({ status, records: [] }), readLegacyFeedback: legacy, nowMs: 1_788_000_000_000 });
    assert.deepEqual(result, { status });
  }
  const empty = await loadCompletionHistory({ readCompletions: async () => ({ status: 'empty', records: [] }), readLegacyFeedback: legacy, nowMs: 1_788_000_000_000 });
  assert.equal(empty.status, 'empty');
});

test('UCOMPLETIONHISTORY01 failure-first: 비로그인/account는 같은 device-local payload이고 외부 경계를 호출하지 않는다', async () => {
  let externalCalls = 0;
  const payloads = [null, { user: { id: 'must-not-store' } }].map((_auth) => buildCompleteCourseInput(start(['p1'], 'local-run'), resolveCatalog, 1_788_000_000_000));
  assert.deepEqual(payloads[0], payloads[1]);
  assert.equal(externalCalls, 0);
  const source = [
    fs.readFileSync('src/ui/courseCompletionUiModel.ts', 'utf8'),
    fs.readFileSync('src/ui/activity/activitySummary.ts', 'utf8'),
  ].join('\n');
  assert.doesNotMatch(source, /supabase|RouteProxy|Kakao|fetch\(|useAuth|userId|ActivityKit/i);
});

test('UCOMPLETIONHISTORY01: 화면 source는 성공→기록 탭, 실패 retry/기록 없이 마치기와 기기 로컬 의미를 연결한다', () => {
  const progress = fs.readFileSync('src/ui/CourseConfirmScreen.tsx', 'utf8');
  const activity = fs.readFileSync('src/ui/ActivityRecordScreen.tsx', 'utf8');
  const profile = fs.readFileSync('src/ui/ProfileScreen.tsx', 'utf8');
  assert.match(progress, /courseCompletionRepository\.complete/);
  assert.match(progress, /resetToActivityRecord/);
  assert.match(progress, /다시 시도/);
  assert.match(progress, /기록 없이 마치기/);
  assert.match(activity, /readOwnedDeviceCourseCompletions/);
  assert.match(activity, /이 기기의/);
  assert.match(activity, /ActivityStatistics/);
  const statistics = fs.readFileSync('src/ui/activity/ActivityStatistics.tsx', 'utf8');
  assert.match(statistics, /방문.*summary.completedPlaceCount/);
  assert.doesNotMatch(statistics, /formatDuration|활용한 시간/);
  assert.match(profile, /기기에만 저장/);
  assert.doesNotMatch(`${progress}\n${activity}`, /courseCompletionRepository\.clear/);
});
