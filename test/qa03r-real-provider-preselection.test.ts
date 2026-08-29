import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COURSE_V1_EXACT_COURSE_LIMIT,
  COURSE_V1_PRESELECTION_ORDERED_COURSE_LIMIT,
  COURSE_V1_PRESELECTION_PLACE_POOL_LIMIT,
} from '../src/engine/courseV1';
import { qa03rScenarios, runQa03rScenario, type Qa03rRecord } from './fixtures/qa03r-real-provider-preselection.fixture';

const ids = (places: readonly { id: string }[]) => places.map((place) => place.id);
const sharedIds = (left: readonly { id: string }[], right: readonly { id: string }[]) => ids(left).filter((id) => ids(right).includes(id));

test('QA03-R: 실제 대표 provider의 고정 생활권 사전선정은 결정적이며 외부 경로 provider를 호출하지 않는다', async () => {
  const first = await Promise.all(qa03rScenarios.map(runQa03rScenario));
  const second = await Promise.all(qa03rScenarios.map(runQa03rScenario));
  assert.deepEqual(second, first);
  assert.equal(first.length, 4);

  for (const record of first) {
    assert.equal(record.providerCandidateCount, 190, record.scenarioId);
    assert.ok(record.candidatePool.length <= COURSE_V1_PRESELECTION_PLACE_POOL_LIMIT, record.scenarioId);
    assert.ok(record.generatedOrderedCourseCount <= COURSE_V1_PRESELECTION_ORDERED_COURSE_LIMIT, record.scenarioId);
    assert.ok(record.preselectedCourses.length <= COURSE_V1_EXACT_COURSE_LIMIT, record.scenarioId);
    assert.ok(record.exactCourseAttemptCount <= COURSE_V1_EXACT_COURSE_LIMIT, record.scenarioId);
    assert.equal(record.externalProviderCalls, 0, record.scenarioId);
    assert.ok(record.candidatePool.every((place) => !place.id.startsWith('qa02-')), record.scenarioId);
    assert.ok(record.preselectedCourses.flat().every((place) => !place.id.startsWith('qa02-')), record.scenarioId);
    if (record.wideSingleCandidate) {
      assert.ok(record.wideSingleInCandidatePool, record.scenarioId);
      assert.ok(record.wideSingleInPreselectedCourses, record.scenarioId);
    }
    // null spy이므로 상태는 경로 통과율이나 실제 공급량으로 해석하지 않는다.
    assert.equal(record.resultState, 'no_verified_course_within_limit', record.scenarioId);
  }

  const seomyeon = first.find((record) => record.scenarioId === 'QA02-01')!;
  assert.ok(seomyeon.preselectedCourses.flat().length > 0, '45분 서면에도 실제 provider 후보가 사전선정돼야 합니다.');

  const overlap = first.map((record, index) => ({
    scenarioId: record.scenarioId,
    candidatePoolOverlapWithEarlier: first.slice(0, index).flatMap((earlier) => sharedIds(record.candidatePool, earlier.candidatePool)),
    preselectedPlaceOverlapWithEarlier: first.slice(0, index).flatMap((earlier) => sharedIds(record.preselectedCourses.flat(), earlier.preselectedCourses.flat())),
  }));
  console.log(`QA03-R preselection ${JSON.stringify({ records: first, overlap })}`);
});
