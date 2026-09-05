import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  COURSE_COMPLETION_STORAGE_KEY,
  buildCourseCompletionActivityReadModel,
  createCourseCompletionRepository,
  type CourseCompletionStorage,
} from '../src/services/courseCompletionRepository';

class MemoryStorage implements CourseCompletionStorage {
  readonly values = new Map<string, string>();
  reads = 0;
  writes = 0;
  removes = 0;
  async getItem(key: string) { this.reads += 1; return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) { this.writes += 1; this.values.set(key, value); }
  async removeItem(key: string) { this.removes += 1; this.values.delete(key); }
}

const place = (contentId: string, overrides = {}) => ({
  contentId,
  title: `장소 ${contentId}`,
  category: '문화시설',
  subCategory: null,
  plannedStayMin: 30,
  actualDwellMin: null,
  ...overrides,
});

const input = (courseRunId: string, completedAt = 1_780_000_000_000, places = [place('p1')]) => ({
  courseRunId,
  completedAt,
  trigger: 'explicit_course_finish' as const,
  places,
});

function fixture(storage = new MemoryStorage()) {
  let sequence = 0;
  return {
    storage,
    repository: createCourseCompletionRepository(storage, {
      createCompletionId: () => `completion-${++sequence}`,
    }),
  };
}

test('DBCOMPLETION01-01: 1곳·2곳 완료를 원래 순서로 저장하고 최신순으로 읽는다', async () => {
  const { repository } = fixture();
  assert.equal((await repository.complete(input('run-1', 100, [place('a')]))).status, 'created');
  assert.equal((await repository.complete(input('run-2', 200, [place('b'), place('c')]))).status, 'created');
  const read = await repository.read();
  assert.equal(read.status, 'ok');
  if (read.status !== 'ok') return;
  assert.deepEqual(read.records.map((record) => record.courseRunId), ['run-2', 'run-1']);
  assert.deepEqual(read.records[0]?.places.map((item) => item.contentId), ['b', 'c']);
});

test('DBCOMPLETION01-02: 같은 courseRunId 순차 재시도는 최초 completionId 한 건을 반환한다', async () => {
  const { repository } = fixture();
  const first = await repository.complete(input('same-run'));
  const second = await repository.complete(input('same-run', 1_780_000_100_000, [place('other')]));
  assert.equal(first.status, 'created');
  assert.equal(second.status, 'already_completed');
  if (!('record' in first) || !('record' in second)) return;
  assert.equal(second.record.completionId, first.record.completionId);
  assert.deepEqual((await repository.read()).records, [first.record]);
});

test('DBCOMPLETION01-03: Promise.all 동시 완료도 같은 storage에서 한 건만 생성한다', async () => {
  const { repository } = fixture();
  const results = await Promise.all(Array.from({ length: 12 }, () => repository.complete(input('concurrent-run'))));
  assert.equal(results.filter((result) => result.status === 'created').length, 1);
  assert.equal(results.filter((result) => result.status === 'already_completed').length, 11);
  assert.equal((await repository.read()).records.length, 1);
});

test('DBCOMPLETION01-04: 같은 장소라도 다른 run과 완료일이면 별도 활동이다', async () => {
  const { repository } = fixture();
  await repository.complete(input('visit-day-1', 100, [place('same-place')]));
  await repository.complete(input('visit-day-2', 200, [place('same-place')]));
  const read = await repository.read();
  assert.equal(read.records.length, 2);
  assert.deepEqual(read.records.map((record) => record.completedAt), [200, 100]);
});

test('DBCOMPLETION01-05: 구조·문자열·시각·체류 입력 오류는 기존 저장값을 바꾸지 않는다', async () => {
  const { repository, storage } = fixture();
  await repository.complete(input('valid'));
  const writes = storage.writes;
  const invalid = [
    input('zero', 100, []),
    input('three', 100, [place('1'), place('2'), place('3')]),
    input('', 100),
    input('blank-content', 100, [place('')]),
    input('bad-time', Number.NaN),
    input('negative-plan', 100, [place('x', { plannedStayMin: -1 })]),
    input('negative-actual', 100, [place('x', { actualDwellMin: -1 })]),
  ];
  for (const value of invalid) assert.equal((await repository.complete(value)).status, 'invalid_input');
  assert.equal(storage.writes, writes);
  assert.equal((await repository.read()).records.length, 1);
});

test('DBCOMPLETION01-06: 명시 코스 마치기 이외 trigger는 저장하지 않는다', async () => {
  const { repository, storage } = fixture();
  for (const trigger of ['course_selected', 'course_viewed', 'navigation_started', 'cancelled']) {
    assert.equal((await repository.complete({ ...input(`run-${trigger}`), trigger } as never)).status, 'invalid_input');
  }
  assert.equal(storage.writes, 0);
});

test('DBCOMPLETION01-07: 실제 체류 미확인은 plannedStayMin으로 승격하지 않고 null을 보존한다', async () => {
  const { repository } = fixture();
  const result = await repository.complete(input('unmeasured', 100, [place('x', { plannedStayMin: 60, actualDwellMin: null })]));
  assert.equal(result.status, 'created');
  if (result.status === 'created') assert.equal(result.record.places[0]?.actualDwellMin, null);
});

test('DBCOMPLETION01-08: 직렬화 payload에는 위치·경로·인증·provider 민감 필드가 없다', async () => {
  const { repository, storage } = fixture();
  await repository.complete({
    ...input('safe-run'),
    userId: 'user', token: 'token', origin: { lat: 1, lon: 2 }, destinationAddress: 'address',
    geometry: [[1, 2]], receipt: { raw: true }, providerUrl: 'https://provider.invalid',
    places: [{ ...place('safe'), lat: 35, lon: 129, address: 'address', geometry: [], receipt: {}, token: 'token' }],
  } as never);
  const raw = storage.values.get(COURSE_COMPLETION_STORAGE_KEY) ?? '';
  for (const forbidden of ['userId', 'token', 'origin', 'destination', 'lat', 'lon', 'address', 'geometry', 'receipt', 'providerUrl']) {
    assert.equal(raw.includes(forbidden), false, forbidden);
  }
});

test('DBCOMPLETION01-09: 손상 JSON/schema는 storage_corrupt이며 완료·정리로 덮어쓰지 않는다', async () => {
  for (const corrupt of ['{broken', JSON.stringify({ schemaVersion: 2, records: [] }), JSON.stringify({ schemaVersion: 1, records: [{ bad: true }] })]) {
    const storage = new MemoryStorage();
    storage.values.set(COURSE_COMPLETION_STORAGE_KEY, corrupt);
    const { repository } = fixture(storage);
    assert.equal((await repository.read()).status, 'storage_corrupt');
    assert.equal((await repository.complete(input('must-not-overwrite'))).status, 'storage_corrupt');
    assert.equal(storage.values.get(COURSE_COMPLETION_STORAGE_KEY), corrupt);
    assert.equal(storage.writes, 0);
  }
});

test('DBCOMPLETION01-10: storage read/write/clear 실패는 성공·empty로 위장하지 않는다', async () => {
  const readFailure: CourseCompletionStorage = { getItem: async () => { throw new Error('read'); }, setItem: async () => {}, removeItem: async () => {} };
  const writeFailure: CourseCompletionStorage = { getItem: async () => null, setItem: async () => { throw new Error('write'); }, removeItem: async () => {} };
  const clearFailure: CourseCompletionStorage = { getItem: async () => null, setItem: async () => {}, removeItem: async () => { throw new Error('clear'); } };
  assert.equal((await createCourseCompletionRepository(readFailure).read()).status, 'storage_unavailable');
  assert.equal((await createCourseCompletionRepository(readFailure).complete(input('read-fail'))).status, 'storage_unavailable');
  assert.equal((await createCourseCompletionRepository(writeFailure).complete(input('write-fail'))).status, 'storage_unavailable');
  assert.equal((await createCourseCompletionRepository(clearFailure).clear()).status, 'storage_unavailable');
});

test('DBCOMPLETION01-11: 1,000건 초과는 완료시각·ID 기준 가장 오래된 기록부터 정리한다', async () => {
  const storage = new MemoryStorage();
  const records = Array.from({ length: 1000 }, (_, index) => ({
    schemaVersion: 1 as const,
    completionId: `existing-${String(index).padStart(4, '0')}`,
    courseRunId: `existing-run-${index}`,
    completedAt: index + 1,
    trigger: 'explicit_course_finish' as const,
    places: [place(`p-${index}`)],
  }));
  storage.values.set(COURSE_COMPLETION_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, records }));
  const { repository } = fixture(storage);
  const created = await repository.complete(input('newest-run', 2000));
  assert.equal(created.status, 'created');
  const read = await repository.read();
  assert.equal(read.records.length, 1000);
  assert.equal(read.records[0]?.courseRunId, 'newest-run');
  assert.equal(read.records.some((record) => record.courseRunId === 'existing-run-0'), false);
  assert.equal((await repository.complete(input('newest-run', 3000))).status, 'already_completed');
  assert.equal((await repository.read()).records.length, 1000);
});

test('DBCOMPLETION01-12: legacy 후기는 그대로 두고 rating·합성 체류를 새 실제 체류로 승격하지 않는다', async () => {
  const legacyKey = '@timefit/place-feedback-v1';
  const legacyRaw = JSON.stringify([{ id: 'old-1', completedAt: 90, contentId: 'legacy-place', title: '과거 장소', category: '카페', rating: 4, actualDwellMin: 39 }]);
  const { repository, storage } = fixture();
  storage.values.set(legacyKey, legacyRaw);
  const created = await repository.complete(input('new-run', 100, [place('new-place', { actualDwellMin: 22 })]));
  assert.equal(created.status, 'created');
  const read = await repository.read();
  const model = buildCourseCompletionActivityReadModel(read.records, JSON.parse(legacyRaw));
  assert.equal(storage.values.get(legacyKey), legacyRaw);
  assert.equal(model.activities[0]?.source, 'completion');
  assert.equal(model.activities[0]?.rating, undefined);
  const legacy = model.activities.find((activity) => activity.source === 'legacy_feedback');
  assert.equal(legacy?.activityId, 'legacy-feedback:old-1');
  assert.equal(legacy?.rating, 4);
  assert.equal(legacy?.actualDwellMin, null);
  assert.equal(legacy?.legacyEstimatedDwellMin, 39);
  assert.equal(model.measuredCount, 1);
  assert.equal(model.unmeasuredCount, 1);
  assert.equal(model.completedDwellMin, 22);
  await repository.clear();
  assert.equal(storage.values.get(legacyKey), legacyRaw);
});

test('DBCOMPLETION01-13: repository와 projection은 Supabase·fetch·외부 API에 의존하지 않는다', () => {
  const source = fs.readFileSync('src/services/courseCompletionRepository.ts', 'utf8');
  assert.doesNotMatch(source, /supabase|\bfetch\b|https?:\/\//i);
  assert.match(source, /@timefit\/course-completions-v1/);
});
