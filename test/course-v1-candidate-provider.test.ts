import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createCourseV1CandidateProvider } from '../src/data/courseV1CandidateProvider';

const fixture = JSON.parse(fs.readFileSync('data/processed/review/코스V1_대표후보_provider_fixture.json', 'utf8'));

test('DATA-2D-1: 368개 런타임 카탈로그에서 만료되지 않은 대표 후보 190개만 CourseV1 입력으로 변환한다', () => {
  const provider = createCourseV1CandidateProvider();
  const candidates = provider.listRepresentativeCandidates(new Date('2026-08-24T10:00:00+09:00'));

  assert.equal(provider.fixtureSummary.runtimeTotal, 368);
  assert.equal(provider.fixtureSummary.representativeTotal, 190);
  assert.equal(provider.fixtureSummary.conditionalTotal, 178);
  assert.deepEqual(fixture.summary, { runtimeTotal: 368, representativeTotal: 190, conditionalTotal: 178, holdTotal: 669 });
  assert.equal(candidates.length, 190);
  assert.deepEqual(candidates.map((candidate) => candidate.id), fixture.representativeCandidateIds);
  for (const candidate of candidates) {
    assert.ok(['representative_core', 'representative_standard'].includes(candidate.classification));
    assert.ok(candidate.minStayMin > 0 && candidate.recommendedStayMin >= candidate.minStayMin);
    assert.ok(candidate.availability.status === 'structured' || candidate.availability.status === 'needs_review');
    assert.ok(candidate.evidenceReviewDueAt);
  }
});

test('DATA-2D-1: 조건부·내부 장소와 근거 만료 대표 후보는 provider 결과에 들어오지 않는다', () => {
  const provider = createCourseV1CandidateProvider();
  const fresh = provider.listRepresentativeCandidates(new Date('2026-08-24T10:00:00+09:00'));
  const expired = provider.listRepresentativeCandidates(new Date('2026-11-22T10:00:00+09:00'));

  assert.equal(fresh.some((candidate) => candidate.classification === 'conditional_more'), false);
  assert.equal(fresh.some((candidate) => candidate.siteRole === 'internal'), false);
  assert.equal(expired.length, 0);
});
