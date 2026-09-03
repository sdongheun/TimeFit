import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const profile = JSON.parse(fs.readFileSync('data/processed/review/부산_장소_근거프로필_재분류.json', 'utf8'));
const baseline = JSON.parse(fs.readFileSync('data/processed/review/부산_장소_근거프로필_기준선.json', 'utf8'));
const runtime = JSON.parse(fs.readFileSync('src/data/busan_poi_catalog.json', 'utf8'));
const conflicts = JSON.parse(fs.readFileSync('data/processed/review/운영시간_충돌_처리결과.json', 'utf8'));
const supply = JSON.parse(fs.readFileSync('data/processed/review/코스공급량_고정시나리오.json', 'utf8'));
const pairTravel = JSON.parse(fs.readFileSync('data/processed/review/장소쌍_실경로_스냅샷.json', 'utf8'));
const routeVerified = JSON.parse(fs.readFileSync('data/processed/review/코스공급량_실경로검증_시나리오.json', 'utf8'));
const structuredAvailability = JSON.parse(fs.readFileSync('data/processed/review/부산_장소_구조화_운영시간.json', 'utf8'));
const routeCoverage = JSON.parse(fs.readFileSync('data/processed/review/코스공급량_실경로검증_커버리지.json', 'utf8'));
const routeCollectionPlan = JSON.parse(fs.readFileSync('data/processed/review/실경로_수집계획.json', 'utf8'));
const plannedPairTravel = JSON.parse(fs.readFileSync('data/processed/review/장소쌍_실경로_계획스냅샷.json', 'utf8'));
const nampoRadiusPairs = JSON.parse(fs.readFileSync('data/processed/review/남포_500m_실경로_장소쌍_스냅샷.json', 'utf8'));
const nampoMeasurement = JSON.parse(fs.readFileSync('data/processed/review/코스공급량_남포500m_실경로측정.json', 'utf8'));
const busanMeasurement = JSON.parse(fs.readFileSync('data/processed/review/코스공급량_부산500m_실경로측정.json', 'utf8'));
const activityReviewQueue = JSON.parse(fs.readFileSync('data/processed/review/활동근거_재검토큐.json', 'utf8'));
const heldDiscoveryReview = JSON.parse(fs.readFileSync('data/processed/review/보류_발견장소_재검토_결과.json', 'utf8'));
const targetedSupplyReview = JSON.parse(fs.readFileSync('data/processed/review/생활권_대표후보_보강_감사.json', 'utf8'));
const allRuntime = [...runtime.matched.data, ...runtime.unmatched.data];
const FIELDS = ['identity', 'activityEvidence', 'stayEvidence', 'availability', 'accessFriction'];

test('DATA-19~23: 기준선의 모든 장소는 하나의 근거 프로필과 대분류를 가진다', () => {
  assert.equal(profile.data.length, baseline.ids.length);
  assert.deepEqual(profile.data.map((p) => p.id).sort(), baseline.ids);
  for (const place of profile.data) {
    assert.ok(['representative_core', 'representative_standard', 'conditional_more', 'hold'].includes(place.classification), `${place.id}: classification`);
    assert.ok(place.classificationReason, `${place.id}: reason`);
    assert.match(place.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(place.reviewDueAt, /^\d{4}-\d{2}-\d{2}$/);
    for (const field of FIELDS) {
      const evidence = place.evidence.filter((item) => item.field === field);
      assert.ok(evidence.length, `${place.id}: ${field} evidence`);
      for (const item of evidence) {
        assert.ok(item.source && item.sourceIdOrUrl && item.sourceText && item.retrievedAt && item.appliesTo, `${place.id}: complete ${field} evidence`);
      }
    }
    if (place.classification === 'conditional_more') {
      assert.notEqual(place.identity, 'unverified', `${place.id}: conditional identity`);
      assert.notEqual(place.activityEvidence, 'unknown', `${place.id}: conditional activity`);
      assert.notEqual(place.stayEvidence, 'unknown', `${place.id}: conditional stay`);
      assert.equal(place.availability, 'unknown', `${place.id}: conditional only lacks availability`);
    }
    if (place.classification === 'hold') assert.ok(place.nextReviewAction, `${place.id}: hold queue action`);
  }
});

test('DATA-21: 대표 분류는 확인된 이용 가능성과 근거 수준을 지킨다', () => {
  for (const place of profile.data.filter((p) => p.classification.startsWith('representative_'))) {
    assert.ok(['verified', 'area_verified'].includes(place.identity), `${place.id}: identity`);
    assert.notEqual(place.activityEvidence, 'unknown', `${place.id}: activity`);
    assert.notEqual(place.stayEvidence, 'unknown', `${place.id}: stay`);
    assert.notEqual(place.availability, 'unknown', `${place.id}: availability`);
    if (place.classification === 'representative_core') {
      assert.ok(['place_specific', 'area_specific'].includes(place.activityEvidence));
      assert.ok(['place_observed', 'area_observed'].includes(place.stayEvidence));
    }
  }
});

test('DATA-23: 권역 근거는 내부 장소에 상속되지 않고 hold로 보존된다', () => {
  for (const place of profile.data.filter((p) => p.scope?.type === '내부장소')) {
    assert.equal(place.classification, 'hold', `${place.id}: internal place is never automatic`);
  }
});

test('활동 근거가 미확정이었던 hold 140개는 재검토 시작 큐에 원천 ID와 판정 항목을 보존한다', () => {
  const expected = heldDiscoveryReview.data.map((row) => row.placeId).sort();
  assert.equal(activityReviewQueue.summary.total, 140);
  assert.deepEqual(activityReviewQueue.data.map((row) => row.placeId).sort(), expected);
  for (const row of activityReviewQueue.data) {
    assert.equal(row.reviewStatus, 'pending_official_source_review');
    assert.ok(row.sourceEvidence.length, `${row.placeId}: official source reference`);
    assert.equal(row.requiredOfficialEvidence.length, 4);
  }
});

test('보류 발견장소 재검토는 140개 전원의 공식 원문 여부·활동 범위·단일 결과를 보존한다', () => {
  const expected = activityReviewQueue.data.map((row) => row.placeId).sort();
  assert.equal(heldDiscoveryReview.summary.total, 140);
  assert.deepEqual(heldDiscoveryReview.data.map((row) => row.placeId).sort(), expected);
  for (const row of heldDiscoveryReview.data) {
    assert.ok(['representative_standard', 'conditional_more', 'hold'].includes(row.outcome), `${row.placeId}: outcome`);
    assert.ok(row.activityReview?.description, `${row.placeId}: activity review`);
    assert.ok(row.scopeReview?.reason, `${row.placeId}: scope review`);
    assert.ok(row.decisionReason, `${row.placeId}: decision reason`);
    if (row.outcome !== 'hold') {
      assert.ok(row.officialEvidence?.activity?.sourceText, `${row.placeId}: activity source text`);
      assert.ok(row.officialEvidence?.stayTemplate?.sourceText, `${row.placeId}: stay template`);
      if (row.outcome === 'representative_standard') assert.ok(row.officialEvidence?.availability?.sourceText, `${row.placeId}: availability source text`);
    }
  }
});

test('실제 동일 장소의 원천별 중복은 siteGroupId로 하드 관계 제외 근거를 가진다', () => {
  const byId = new Map(profile.data.map((place) => [place.id, place]));
  for (const [left, right, group] of [['poi_13', 'poi_16', 'jagalchi_tourism_area'], ['poi_19', 'poi_22', 'dongbaek_park_island'], ['poi_173', 'poi_629', 'songdo_beach']]) {
    assert.equal(byId.get(left).siteGroupId, group);
    assert.equal(byId.get(right).siteGroupId, group);
    assert.ok(byId.get(left).siteGroupEvidence);
  }
});

test('후속 충돌 게이트: 미해결 운영시간 충돌은 대표 추천에 남지 않는다', () => {
  assert.equal(conflicts.summary.total, 39);
  const profileById = new Map(profile.data.map((place) => [place.id, place]));
  const targetedPromotionIds = new Set(targetedSupplyReview.data
    .filter((row) => row.finalClassification === 'representative_standard' && row.officialEvidence?.url)
    .map((row) => row.placeId));
  for (const conflict of conflicts.data) {
    const place = profileById.get(conflict.placeId);
    assert.ok(place, `${conflict.placeId}: profile exists`);
    if (conflict.decision === 'hold') {
      if (targetedPromotionIds.has(conflict.placeId)) {
        assert.equal(place.classification, 'representative_standard', `${conflict.placeId}: later official re-review promoted`);
        assert.ok(place.evidence.some((item) => item.source === 'targeted_representative_supply'), `${conflict.placeId}: official re-review evidence`);
        continue;
      }
      assert.equal(place.classification, 'hold', `${conflict.placeId}: unresolved conflict held`);
      assert.ok(place.nextReviewAction, `${conflict.placeId}: review queue`);
    } else {
      assert.equal(conflict.conflictType, '표기 차이', `${conflict.placeId}: only notation difference remains`);
      assert.ok(place.classification.startsWith('representative_'), `${conflict.placeId}: resolved representative`);
    }
  }
});

test('DATA-19~22: 런타임은 재분류 원천에서 hold를 제외해 재생성된다', () => {
  const allowed = new Set(profile.data.filter((p) => p.classification !== 'hold').map((p) => p.id));
  assert.deepEqual(new Set(allRuntime.map((p) => p.contentId)), allowed);
  for (const place of allRuntime) {
    assert.ok(['representative_core', 'representative_standard', 'conditional_more'].includes(place.classification));
    assert.ok(place.evidenceProfile?.evidence?.length, `${place.contentId}: runtime evidence profile`);
  }
});

test('DATA-24: 고정 시각에서 만료한 시설·상권 근거는 hold 재검토 큐로 이동한다', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'timefit-profile-'));
  const output = path.join(temp, 'profile.json');
  const snapshot = path.join(temp, 'baseline.json');
  execFileSync('node', ['scripts/build_evidence_profile_catalog.mjs'], {
    cwd: root,
    env: { ...process.env, DATA_CLASSIFICATION_DATE: '2026-11-22', DATA_CLASSIFICATION_OUTPUT: output, DATA_CLASSIFICATION_BASELINE: snapshot },
    stdio: 'pipe',
  });
  const expired = JSON.parse(fs.readFileSync(output, 'utf8'));
  assert.equal(expired.summary.classification.representative_core ?? 0, 0);
  assert.equal(expired.summary.classification.representative_standard ?? 0, 0);
  assert.equal(expired.summary.classification.conditional_more ?? 0, 0);
  assert.equal(expired.summary.classification.hold, expired.summary.total);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('후속 공급량 계약: 실제 좌표·장소쌍 fixture는 1~3곳을 동시 비교하고 중복 제거 결과를 보존한다', () => {
  assert.equal(supply.summary.total, 16 * 4 * 4 * 2);
  assert.equal(supply.meta.measurementGrade, 'heuristic_diagnostic');
  const courseSizes = new Set();
  for (const scenario of supply.scenarios) {
    assert.ok(Number.isFinite(scenario.origin.lat) && Number.isFinite(scenario.origin.lon));
    assert.ok(Number.isFinite(scenario.destination.lat) && Number.isFinite(scenario.destination.lon));
    assert.equal(scenario.measurementGrade, 'heuristic_diagnostic');
    assert.equal(scenario.localTopN, 5);
    assert.equal(scenario.eligibleCandidateCount, scenario.candidatePlaceIds.length + scenario.excludedCandidatePlaceIds.length);
    assert.ok(scenario.rawCoursePermutationCount >= scenario.relationshipFilteredCourseCount);
    assert.ok(scenario.relationshipFilteredCourseCount >= scenario.deduplicatedFeasibleCourseCount);
    assert.equal(scenario.representativeCourseCount, scenario.deduplicatedFeasibleCourseCount ? 1 : 0);
    assert.equal(scenario.newRecommendationCount, Math.max(0, scenario.deduplicatedFeasibleCourseCount - 1));
    assert.ok(['no_candidates', 'no_alternative_verified_course', 'alternatives_available'].includes(scenario.nextRecommendationState));
    if (scenario.arrivalType === 'separate_destination') assert.notEqual(scenario.origin.id, scenario.destination.id);
    if (scenario.deduplicatedFeasibleCourseCount === 0) assert.ok(scenario.zeroCandidateReason);
    else {
      assert.equal(scenario.zeroCandidateReason, null);
      for (const course of [scenario.representativeCourse, ...scenario.alternativeCourses]) {
        assert.ok(course.placeIds.length >= 1 && course.placeIds.length <= 3);
        assert.ok(course.segments.length === course.placeIds.length + 1);
        courseSizes.add(course.placeIds.length);
      }
    }
  }
  assert.deepEqual([...courseSizes].sort(), [1, 2, 3]);
});

test('공급량 코스 빌더는 운영시간 원문 대신 별도 구조화 availability 산출물을 사용한다', () => {
  assert.equal(supply.meta.availabilitySource, 'data/processed/review/부산_장소_구조화_운영시간.json');
  assert.equal(structuredAvailability.data.length, profile.data.length);
  for (const entry of structuredAvailability.data.filter((item) => item.status === 'structured')) {
    assert.ok(entry.sourceText);
    assert.ok(entry.sourceEvidence.length);
    assert.ok(entry.dayTypes.length);
    assert.ok(entry.windows.length);
  }
});

test('실경로 감사 fixture는 의미 있는 거점의 왕복 장소쌍·조회 근거를 보존한다', () => {
  assert.equal(pairTravel.summary.failed, 0);
  assert.equal(pairTravel.summary.ok, 22);
  const profileById = new Map(profile.data.map((place) => [place.id, place]));
  for (const pair of pairTravel.data) {
    assert.equal(pair.status, 'ok');
    assert.equal(pair.fromId, pair.from.id);
    assert.equal(pair.toId, pair.to.id);
    assert.equal(pair.from.lat, profileById.get(pair.fromId).lat);
    assert.equal(pair.from.lon, profileById.get(pair.fromId).lon);
    assert.equal(pair.to.lat, profileById.get(pair.toId).lat);
    assert.equal(pair.to.lon, profileById.get(pair.toId).lon);
    assert.equal(pair.mode, 'walk');
    assert.ok(Number.isFinite(pair.totalMoveMin) && pair.totalMoveMin > 0);
    assert.ok(Number.isFinite(pair.from.lat) && Number.isFinite(pair.to.lon));
    assert.equal(pair.provider, 'TMAP pedestrian routes');
    assert.match(pair.retrievedAt, /^\d{4}-\d{2}-\d{2}T/);
  }
});

test('실경로 공급량 fixture는 구조화 availability와 실제 TMAP 전 구간으로 1~3곳을 비교한다', () => {
  assert.equal(routeVerified.summary.routeVerifiedCourseFixture, 6);
  assert.deepEqual(routeVerified.summary.byPlaceCount, { 1: 2, 2: 2, 3: 2 });
  for (const scenario of routeVerified.scenarios) {
    assert.equal(scenario.measurementGrade, 'route_verified_course_fixture');
    const places = scenario.places ?? [scenario.place];
    assert.ok(places.length >= 1 && places.length <= 3);
    assert.equal(scenario.segments.length, places.length + 1);
    for (const segment of scenario.segments) {
      assert.equal(segment.status, 'ok');
      assert.equal(segment.mode, 'walk');
      assert.equal(segment.provider, 'TMAP pedestrian routes');
      assert.ok(Number.isFinite(segment.totalMoveMin) && segment.totalMoveMin > 0);
      assert.match(segment.retrievedAt, /^\d{4}-\d{2}-\d{2}T/);
    }
    for (const place of places) {
      assert.ok(place.availability.windows?.length || place.availability.alwaysAccessible);
      assert.ok(place.availability.sourceText);
      assert.equal(place.availability.status, 'structured');
    }
  }
  const three = routeVerified.scenarios.find((scenario) => scenario.places?.length === 3);
  assert.equal(three.evaluation.totalMin, 175);
  assert.equal(three.evaluation.budgetPass, true);
});

test('실경로 커버리지는 제품 정책 범위의 측정 부재와 500m 진단 slice를 분리한다', () => {
  assert.equal(routeCoverage.summary.matrixTotal, 16 * 4 * 4 * 2);
  assert.equal(routeCoverage.summary.routeVerifiedMatrixCount, 0);
  assert.equal(routeCoverage.summary.heuristicDiagnosticMatrixCount, 512);
  assert.equal(routeCoverage.summary.routeVerifiedZeroResultRate, null);
  assert.equal(routeCoverage.summary.diagnosticSliceScenarioCount, 512);
  assert.equal(routeCoverage.summary.diagnosticSliceZeroResultRate, busanMeasurement.summary.diagnosticZeroResultRate);
  const verified = routeCoverage.data.filter((row) => row.measurementGrade === 'route_verified_measurement');
  assert.equal(verified.length, 0);
  for (const row of routeCoverage.data.filter((row) => row.measurementGrade === 'heuristic_diagnostic')) {
    assert.equal(row.status, 'missing_full_real_route_1_to_3');
    assert.ok(row.missingReason);
  }
});

test('남포 500m 실제 경로 결과는 후보 상한 없는 진단 slice로 보존한다', () => {
  assert.equal(nampoRadiusPairs.summary.candidateCount, 5);
  assert.equal(nampoRadiusPairs.summary.ok, nampoRadiusPairs.summary.pairCount);
  assert.equal(nampoMeasurement.summary.scenarioCount, 32);
  for (const scenario of nampoMeasurement.scenarios) {
    assert.equal(scenario.measurementGrade, 'route_verified_diagnostic_slice');
    assert.equal(scenario.fullCandidateScope, true);
    assert.equal(scenario.candidateScope.radiusM, 500);
    assert.equal(scenario.candidateScope.candidatePlaceIds.length, 5);
    assert.equal(scenario.rawCoursePermutationCount, 85);
    assert.equal(scenario.actualRouteEvaluatedCourseCount, 85);
    assert.equal(scenario.zeroReasonBreakdown.missing_actual_route, undefined);
    assert.deepEqual(Object.keys(scenario.courseSizeComparison), ['1', '2', '3']);
    assert.ok(scenario.courseSizeComparison[3].evaluated > 0);
  }
});

test('부산 16개 생활권의 500m 실제 경로 결과는 제품 정책 공급량과 분리된 진단 slice다', () => {
  assert.equal(busanMeasurement.summary.scenarioCount, 16 * 4 * 4 * 2);
  assert.equal(busanMeasurement.summary.areaCount, 16);
  assert.equal(busanMeasurement.summary.pairSnapshotCount, 58);
  for (const scenario of busanMeasurement.scenarios) {
    assert.equal(scenario.measurementGrade, 'route_verified_diagnostic_slice');
    assert.equal(scenario.fullCandidateScope, true);
    assert.equal(scenario.candidateScope.radiusM, 500);
    assert.deepEqual(Object.keys(scenario.courseSizeComparison), ['1', '2', '3']);
    assert.equal(scenario.actualRouteEvaluatedCourseCount, scenario.relationshipFilteredCourseCount);
    assert.equal(scenario.zeroReasonBreakdown.missing_actual_route, undefined);
  }
});

test('실경로 수집계획은 생활권별 의미 있는 서로 다른 거점을 명시하고 구조화 availability를 확인한다', () => {
  assert.equal(routeCollectionPlan.summary.total, 16);
  assert.equal(routeCollectionPlan.summary.ready, 16);
  const availabilityById = new Map(structuredAvailability.data.map((item) => [item.placeId, item]));
  for (const plan of routeCollectionPlan.data) {
    assert.ok(plan.origin.reason);
    assert.ok(plan.destination?.reason, `${plan.borough}: separate destination anchor`);
    assert.notEqual(plan.origin.placeId, plan.destination.placeId);
    const ids = [plan.origin.placeId, ...plan.candidatePlaceIds, plan.destination.placeId];
    assert.equal(new Set(ids).size, ids.length, `${plan.borough}: repeated plan id`);
    for (const id of ids) assert.equal(availabilityById.get(id)?.status, 'structured', `${plan.borough}: ${id}`);
  }
});

test('수집계획의 실제 TMAP 장소쌍은 빈 응답을 성공으로 처리하지 않고 근거 좌표를 보존한다', () => {
  assert.equal(plannedPairTravel.summary.planned, 98);
  assert.equal(plannedPairTravel.summary.ok, 98);
  assert.equal(plannedPairTravel.summary.failed, 0);
  const profileById = new Map(profile.data.map((place) => [place.id, place]));
  for (const pair of plannedPairTravel.data) {
    assert.equal(pair.status, 'ok');
    assert.equal(pair.provider, 'TMAP pedestrian routes');
    assert.equal(pair.from.lat, profileById.get(pair.fromId).lat);
    assert.equal(pair.to.lon, profileById.get(pair.toId).lon);
  }
});
