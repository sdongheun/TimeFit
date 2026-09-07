import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createCourseV1CandidateProvider } from '../src/data/courseV1CandidateProvider';
import { buildExplorationPageV1 } from '../src/engine/courseV1';
import runtimeCatalog from '../src/data/busan_poi_catalog.json';

const fixture = JSON.parse(fs.readFileSync('data/processed/review/코스V1_대표후보_provider_fixture.json', 'utf8'));

test('DATA-2D-1/DATA-SUPPLY-01: 369개 런타임 카탈로그에서 만료되지 않은 대표 후보 191개만 CourseV1 입력으로 변환한다', () => {
  const provider = createCourseV1CandidateProvider();
  const candidates = provider.listRepresentativeCandidates(new Date('2026-09-01T10:00:00+09:00'));

  assert.equal(provider.fixtureSummary.runtimeTotal, 369);
  assert.equal(provider.fixtureSummary.representativeTotal, 191);
  assert.equal(provider.fixtureSummary.conditionalTotal, 178);
  assert.deepEqual(fixture.summary, { runtimeTotal: 369, representativeTotal: 191, conditionalTotal: 178, holdTotal: 668 });
  assert.equal(candidates.length, 191);
  assert.deepEqual(candidates.map((candidate) => candidate.id), fixture.representativeCandidateIds);
  for (const candidate of candidates) {
    assert.ok(['representative_core', 'representative_standard'].includes(candidate.classification));
    assert.ok(candidate.minStayMin > 0 && candidate.recommendedStayMin >= candidate.minStayMin);
    assert.ok(candidate.availability.status === 'structured' || candidate.availability.status === 'needs_review');
    assert.ok(candidate.evidenceReviewDueAt);
  }
});

test('DATA-DWELL-01: 대표 후보의 최소·권장·최대 체류 범위를 카탈로그 원본값 그대로 전달한다', () => {
  const provider = createCourseV1CandidateProvider();
  const candidates = provider.listRepresentativeCandidates(new Date('2026-09-01T10:00:00+09:00'));
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const representativePlaces = [...runtimeCatalog.matched.data, ...runtimeCatalog.unmatched.data]
    .filter((place) => place.classification === 'representative_core' || place.classification === 'representative_standard');

  assert.equal(representativePlaces.length, 191);
  assert.equal(candidateById.size, 191);
  for (const place of representativePlaces) {
    const candidate = candidateById.get(place.contentId);
    assert.ok(candidate, `${place.contentId}: representative candidate missing`);
    assert.deepEqual(
      [candidate.minStayMin, candidate.recommendedStayMin, candidate.maxStayMin],
      [place.shortStay.minStayMin, place.shortStay.recommendedStayMin, place.shortStay.maxStayMin],
      `${place.contentId}: shortStay projection changed`,
    );
    assert.ok(candidate.minStayMin > 0);
    assert.ok(candidate.minStayMin <= candidate.recommendedStayMin);
    assert.ok(candidate.recommendedStayMin <= candidate.maxStayMin!);
  }

  assert.equal(candidateById.get('poi_1')?.maxStayMin, 60);
  assert.equal(candidateById.get('poi_25')?.maxStayMin, 120);
});

test('DATA-RELEASE-PERSONALIZATION-01: provider는 정제 category/subCategory 복합 키를 추정 없이 전달한다', () => {
  const provider = createCourseV1CandidateProvider();
  const now = new Date('2026-09-07T10:00:00+09:00');
  const candidates = provider.listRepresentativeCandidates(now);
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const runtimePlaces = [...runtimeCatalog.matched.data, ...runtimeCatalog.unmatched.data];
  const runtimeById = new Map(runtimePlaces.map((place) => [place.contentId, place]));
  const representativePlaces = runtimePlaces
    .filter((place) => place.classification === 'representative_core' || place.classification === 'representative_standard');

  assert.equal(candidateById.size, representativePlaces.length);
  for (const place of representativePlaces) {
    const candidate = candidateById.get(place.contentId);
    assert.ok(candidate, `${place.contentId}: representative candidate missing`);
    assert.equal(candidate.category, place.category, `${place.contentId}: category projection changed`);
    assert.equal(candidate.subCategory, place.subCategory ?? undefined, `${place.contentId}: subCategory projection changed`);
  }

  assert.deepEqual(
    [candidateById.get('poi_69')?.category, candidateById.get('poi_69')?.subCategory],
    ['상업지구', '거리·골목'],
  );
  assert.deepEqual(
    [candidateById.get('poi_79')?.category, candidateById.get('poi_79')?.subCategory],
    ['자연관광지', '거리·골목'],
  );
  assert.equal(candidateById.get('poi_1047')?.subCategory, undefined);

  for (const candidate of [
    ...provider.listDiscoveryCandidates(now),
    ...provider.listConditionalVisitCandidates(now),
  ]) {
    const place = runtimeById.get(candidate.id);
    assert.ok(place, `${candidate.id}: public provider place missing`);
    assert.equal(candidate.category, place.category, `${candidate.id}: public provider category projection changed`);
    assert.equal(candidate.subCategory, place.subCategory ?? undefined, `${candidate.id}: public provider subCategory projection changed`);
  }
});

test('DATA-2D-1: 조건부·내부 장소와 근거 만료 대표 후보는 provider 결과에 들어오지 않는다', () => {
  const provider = createCourseV1CandidateProvider();
  const fresh = provider.listRepresentativeCandidates(new Date('2026-09-01T10:00:00+09:00'));
  const expired = provider.listRepresentativeCandidates(new Date('2026-11-22T10:00:00+09:00'));

  assert.equal(fresh.some((candidate) => candidate.classification === 'conditional_more'), false);
  assert.equal(fresh.some((candidate) => candidate.siteRole === 'internal'), false);
  assert.equal(expired.length, 0);
});

test('DATA-AREA-01: provider는 감사된 대표·area_access·conditional 발견 자격과 placeKind를 명시 전달한다', () => {
  const provider = createCourseV1CandidateProvider();
  const now = new Date('2026-09-01T10:00:00+09:00');
  const candidates = provider.listDiscoveryCandidates(now);
  const counts = candidates.reduce<Record<string, number>>((result, candidate) => {
    result[candidate.discovery.eligibility] = (result[candidate.discovery.eligibility] ?? 0) + 1;
    return result;
  }, {});

  assert.deepEqual(counts, { representative: 191, area_access: 2, conditional: 176 });
  assert.deepEqual(candidates.filter((candidate) => candidate.discovery.eligibility === 'area_access').map((candidate) => candidate.id), ['poi_646', 'poi_662']);
  for (const candidate of candidates.filter((item) => item.discovery.eligibility === 'area_access')) {
    assert.equal(candidate.discovery.accessEvidence?.status, 'public_outdoor_access');
    assert.equal(candidate.discovery.accessWindow?.kind, 'always');
    assert.equal(candidate.discovery.placeKind, 'area');
  }
  assert.equal(candidates.find((candidate) => candidate.id === 'poi_90')?.discovery.eligibility, 'conditional');
  assert.equal(candidates.find((candidate) => candidate.id === 'poi_41')?.discovery.placeKind, 'facility');

  const page = buildExplorationPageV1({
    now,
    origin: { id: 'origin', lat: 35.1578, lon: 129.0594 },
    destination: null,
    remainingMin: 90,
    arrivalBufferMin: 5,
    candidates: candidates.filter((candidate) => candidate.discovery.eligibility === 'area_access'),
    pageSize: 2,
  });
  assert.deepEqual(page.places.filter((place) => place.eligibility === 'area_access').map((place) => place.placeId), ['poi_646', 'poi_662']);
});

test('DATA-MARKET-01: provider는 조건부 시장·거리 정보 확인 후보만 10:00–18:00 창과 함께 전달한다', () => {
  const provider = createCourseV1CandidateProvider();
  const candidates = provider.listConditionalVisitCandidates(new Date('2026-08-24T10:00:00+09:00'));

  assert.equal(candidates.length, 142);
  assert.ok(candidates.some((candidate) => candidate.id === 'poi_10'));
  assert.equal(candidates.some((candidate) => ['poi_90', 'poi_319', 'traditional_market_104'].includes(candidate.id)), false);
  for (const candidate of candidates) {
    assert.equal(candidate.classification, 'conditional_more');
    assert.deepEqual(candidate.conditionalVisit, {
      kind: 'market_or_street',
      displayWindow: { start: '10:00', end: '18:00' },
      requiresUserHoursConfirmation: true,
    });
  }
});
