#!/usr/bin/env node
// 현행 자투리 활동 검토 결과를 근거 프로필/대분류 계약으로 정규화한다.
// 이 스크립트는 장소를 삭제하지 않는다. 활성 356개와 기존 review/excluded를 모두
// 하나의 재검토 원천에 보존하고, 런타임 빌더는 이 결과에서 활성 세 분류만 읽는다.
import fs from 'node:fs';

const ACTIVE = 'data/processed/review/부산_자투리장소_카탈로그_초안.json';
const DECISIONS = 'data/processed/review/부산_자투리장소_보류및제외.json';
const HOURS = 'data/processed/review/사용중_장소_운영시간_원천감사.json';
const CONFLICT_RESOLUTIONS = 'data/processed/review/운영시간_충돌_처리결과.json';
const HELD_DISCOVERY_REVIEW = 'data/processed/review/보류_발견장소_재검토_결과.json';
const TARGETED_SUPPLY_REVIEW = 'data/processed/review/생활권_대표후보_보강_감사.json';
const OUTPUT = process.env.DATA_CLASSIFICATION_OUTPUT ?? 'data/processed/review/부산_장소_근거프로필_재분류.json';
const BASELINE = process.env.DATA_CLASSIFICATION_BASELINE ?? 'data/processed/review/부산_장소_근거프로필_기준선.json';
const NOW = process.env.DATA_CLASSIFICATION_DATE ?? '2026-08-24';
const EVIDENCE_DATE = '2026-08-23'; // 운영시간 원천 감사의 실제 수집일; 빌드 시각으로 갱신하지 않는다.
// 같은 물리 장소가 원천별로 별도 ID인 경우에만 사람 검토로 묶는다. 이름 유사만으로 묶지 않는다.
const SITE_GROUP_OVERRIDES = new Map([
  ['poi_13', { id: 'jagalchi_tourism_area', reason: '부산 자갈치시장과 용두산 자갈치 관광특구는 같은 자갈치 해안로 52 좌표·관광권역이다.' }],
  ['poi_16', { id: 'jagalchi_tourism_area', reason: '부산 자갈치시장과 용두산 자갈치 관광특구는 같은 자갈치 해안로 52 좌표·관광권역이다.' }],
  ['poi_19', { id: 'dongbaek_park_island', reason: '동백공원과 해운대 동백섬은 같은 동백로 해안공원 권역의 중복 관광 엔터티다.' }],
  ['poi_22', { id: 'dongbaek_park_island', reason: '동백공원과 해운대 동백섬은 같은 동백로 해안공원 권역의 중복 관광 엔터티다.' }],
  ['poi_173', { id: 'songdo_beach', reason: '송도해수욕장 두 원천 ID는 송도해변로 100의 동일 해수욕장 엔터티다.' }],
  ['poi_629', { id: 'songdo_beach', reason: '송도해수욕장 두 원천 ID는 송도해변로 100의 동일 해수욕장 엔터티다.' }],
]);
const CATEGORY_DWELL_REFERENCE = {
  자연관광지: { count: 2710, median: 60, p25: 30, p75: 90, mean: 69 },
  문화시설: { count: 762, median: 60, p25: 30, p75: 120, mean: 84 },
  상업지구: { count: 2418, median: 60, p25: 30, p75: 60, mean: 59 },
  '레저/스포츠': { count: 332, median: 90, p25: 60, p75: 180, mean: 123 },
};

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const plusDays = (date, days) => new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000;
const dateText = (ms) => new Date(ms).toISOString().slice(0, 10);
const countBy = (items, selector) => Object.fromEntries([...items.reduce((m, item) => {
  const key = selector(item); m.set(key, (m.get(key) ?? 0) + 1); return m;
}, new Map()).entries()].sort(([a], [b]) => a.localeCompare(b, 'ko')));

const active = read(ACTIVE).data;
const decisions = read(DECISIONS);
const auditById = new Map(read(HOURS).data.map((row) => [row.contentId, row]));
const conflictById = new Map(read(CONFLICT_RESOLUTIONS).data.map((row) => [row.placeId, row]));
const heldDiscoveryReviewById = new Map((fs.existsSync(HELD_DISCOVERY_REVIEW) ? read(HELD_DISCOVERY_REVIEW).data : [])
  .map((row) => [row.placeId, row]));
const targetedSupplyReviewById = new Map((fs.existsSync(TARGETED_SUPPLY_REVIEW) ? read(TARGETED_SUPPLY_REVIEW).data : [])
  .map((row) => [row.placeId, row]));
const all = [...active, ...decisions.review, ...decisions.excluded];
if (new Set(all.map((place) => place.id)).size !== all.length) throw new Error('기준선 장소 ID가 중복되었습니다.');

function sourceEvidence(place, field, sourceText, appliesTo = 'place') {
  const sources = place.sourceEvidence?.length ? place.sourceEvidence : [{ source: 'legacy_review', sourceId: place.id }];
  return sources.map((source) => ({
    field,
    source: source.source,
    sourceIdOrUrl: String(source.sourceId ?? place.id),
    sourceText,
    retrievedAt: EVIDENCE_DATE,
    appliesTo,
  }));
}

function hourEvidence(place, audit, availability) {
  const rows = [audit?.tourapi, ...(audit?.busanOfficial ?? [])]
    .filter((item) => item?.hours || item?.status === 'queried')
    .map((item) => ({
      field: 'availability', source: item.source ?? 'tourapi_detailIntro2',
      sourceIdOrUrl: String(item.sourceId ?? place.sourceEvidence?.[0]?.sourceId ?? place.id),
      sourceText: item.hours ?? '시간 범위 미기재', retrievedAt: EVIDENCE_DATE,
      appliesTo: place.scope?.type === '포괄장소' ? 'area' : 'place',
    }));
  if (rows.length) return rows;
  return [{ field: 'availability', source: 'opening_hours_audit', sourceIdOrUrl: place.id,
    sourceText: `운영시간 감사 결과: ${audit?.finalStatus ?? '원천 미연결'}`,
    retrievedAt: EVIDENCE_DATE, appliesTo: availability === 'always_accessible_audited' ? 'outdoor_route' : 'place' }];
}

function placeKind(place) {
  if (place.scope?.type === '포괄장소') return 'area';
  if (place.shortStayType === 'scenic_pause' && /해변|해안|공원|산책|전망|광장|수변/.test(place.title)) return 'outdoor_route';
  return 'point_facility';
}
function identity(place, kind) {
  if (!Number.isFinite(place.lat) || !Number.isFinite(place.lon) || !place.sourceEvidence?.length) return 'unverified';
  return kind === 'area' ? 'area_verified' : 'verified';
}
function availability(place, audit, kind) {
  if (audit?.finalStatus === '구조화된_시간확인') return kind === 'area' ? 'area_hours' : 'fixed_hours';
  // 상시 접근은 자연관광지라는 이름만으로 결정하지 않고, 과거 활성 판정에서 outdoor 정책과
  // 정확 좌표 매칭이 함께 있었던 야외 경로만 보수적으로 인정한다.
  if (kind === 'outdoor_route' && place.selectionStatus === 'approved'
    && place.selectionEvidence?.exactAihubMatch && /해수욕장|해변|해안|공원|산책로|전망|광장/.test(place.title)) {
    return 'always_accessible_audited';
  }
  return 'unknown';
}
function activityEvidence(place, kind) {
  if (!place.shortStayType) return 'unknown';
  if (kind === 'area') return 'area_specific';
  return place.selectionEvidence?.exactAihubMatch ? 'place_specific' : 'activity_template';
}
function stayEvidence(place, kind) {
  if (!place.shortStayType) return 'unknown';
  if (place.selectionEvidence?.exactAihubMatch) return kind === 'area' ? 'area_observed' : 'place_observed';
  return 'activity_template';
}
function accessFriction(place) {
  if (place.reservationRequired === true) return 'reservation_required';
  if (place.reservationRequired === 'unknown') return 'unknown';
  return place.entryExitFriction ? 'open' : 'unknown';
}
function reviewDue(availabilityValue) {
  if (availabilityValue === 'always_accessible_audited') return dateText(plusDays(EVIDENCE_DATE, 365));
  if (availabilityValue === 'event_window') return NOW;
  return dateText(plusDays(EVIDENCE_DATE, 90));
}

function applyTargetedSupplyReview(result, review) {
  if (!review || review.finalClassification !== 'representative_standard') return result;
  if (review.reviewDueAt < NOW) return result;
  const availability = review.availability;
  if (availability?.kind !== 'area_hours' || availability.windows?.length !== 1
    || availability.windows[0].start !== '09:00' || availability.windows[0].end !== '20:00'
    || !Array.isArray(availability.runtimeOperatingHours)) throw new Error(`${result.id}: invalid targeted supply availability`);
  const source = review.officialEvidence;
  if (!source?.url || !source.sourceText || !review.reviewedAt || !review.reviewDueAt) throw new Error(`${result.id}: missing targeted supply official evidence`);
  return {
    ...result,
    operatingHours: availability.runtimeOperatingHours,
    availability: availability.kind,
    accessFriction: 'open',
    evidence: [
      ...result.evidence.filter((item) => !['availability', 'accessFriction'].includes(item.field)),
      { field: 'availability', source: 'targeted_representative_supply', sourceIdOrUrl: source.url, sourceText: source.sourceText, retrievedAt: review.reviewedAt, appliesTo: 'area' },
      { field: 'accessFriction', source: 'targeted_representative_supply', sourceIdOrUrl: source.url, sourceText: '공식 권역 안내에 따른 공개 시장 접근; 개별 점포 이용 조건은 상속하지 않음', retrievedAt: review.reviewedAt, appliesTo: 'area' },
    ],
    verifiedAt: review.reviewedAt,
    reviewDueAt: review.reviewDueAt,
    classification: 'representative_standard',
    classificationReason: 'DATA-SUPPLY-01: official area access hours and existing short-stay evidence are connected; promoted without widening dwell or policy.',
    nextReviewAction: null,
  };
}
function nextAction(place, reason) {
  if (/represented_by_parent_area/.test(reason)) return '대표 권역과 내부 장소 관계를 유지하고 내부 장소를 자동 추천에서 제외한다.';
  if (/food|long_or|non_visit/.test(reason)) return '자투리 활동 정책이 바뀌기 전까지 하드 제외를 유지한다.';
  if (!place.shortStayType) return '공식 소개 원문으로 활동 유형과 짧은 방문 완결성을 사람 검토한다.';
  if (!Number.isFinite(place.lat) || !Number.isFinite(place.lon)) return '공식 원천 ID와 좌표를 다시 연결한다.';
  return '공식 운영시간·활동·체류 근거를 수집한 뒤 재분류한다.';
}

function classify(place) {
  const audit = auditById.get(place.id);
  const kind = placeKind(place);
  const values = {
    identity: identity(place, kind), placeKind: kind,
    activityEvidence: activityEvidence(place, kind), stayEvidence: stayEvidence(place, kind),
    availability: availability(place, audit, kind), accessFriction: accessFriction(place),
  };
  const isOldActive = ['approved', 'conditional'].includes(place.selectionStatus);
  const usableIdentity = values.identity !== 'unverified';
  const usableActivity = values.activityEvidence !== 'unknown';
  const usableStay = values.stayEvidence !== 'unknown';
  const available = values.availability !== 'unknown';
  let classification = 'hold';
  let classificationReason = place.decisionReasons?.join('; ') || 'existing_review_or_exclusion';
  if (isOldActive && usableIdentity && usableActivity && usableStay && available
    && !['reservation_required', 'program_dependent'].includes(values.accessFriction)) {
    classification = ['place_specific', 'area_specific'].includes(values.activityEvidence)
      && ['place_observed', 'area_observed'].includes(values.stayEvidence)
      ? 'representative_core' : 'representative_standard';
    classificationReason = 'identity, activity/stay evidence, and official availability are connected in the evidence profile';
  } else if (isOldActive && usableIdentity && usableActivity && usableStay && !available) {
    classification = 'conditional_more';
    classificationReason = 'the only automatic-recommendation blocker is unavailable official opening/access hours';
  } else if (!usableIdentity || !usableActivity || !usableStay) {
    classificationReason = `${classificationReason}; missing identity, activity, or stay evidence`;
  }
  const dueAt = reviewDue(values.availability);
  const conflict = conflictById.get(place.id);
  const siteGroup = SITE_GROUP_OVERRIDES.get(place.id);
  if (conflict?.decision === 'hold') {
    classification = 'hold';
    classificationReason = `opening-hours conflict (${conflict.conflictType}): ${conflict.decisionReason}`;
  }
  if (classification !== 'hold' && dueAt < NOW) {
    classification = 'hold';
    classificationReason = `evidence review due ${dueAt}; refresh official evidence before automatic recommendation`;
  }
  const evidence = [
    ...sourceEvidence(place, 'identity', `${place.title}; 좌표 ${place.lat},${place.lon}`, kind === 'area' ? 'area' : 'place'),
    ...sourceEvidence(place, 'activityEvidence', `검토 활동 유형: ${place.shortStayType ?? '미확인'}`, kind === 'area' ? 'area' : 'place'),
    ...sourceEvidence(place, 'stayEvidence', `체류 근거: ${place.dwellBasis ?? '미확인'}; ${place.recommendedStayMin ?? '미확인'}분`, kind === 'area' ? 'area' : 'place'),
    ...hourEvidence(place, audit, values.availability),
    ...sourceEvidence(place, 'accessFriction', `입장 부담: ${values.accessFriction}`, kind === 'area' ? 'area' : 'place'),
    ...(conflict ? conflict.sourceValues.map((item) => ({ field: 'availability', ...item, retrievedAt: conflict.reviewedAt })) : []),
  ];
  const result = {
    ...place,
    siteGroupId: siteGroup?.id ?? place.siteGroupId ?? null,
    siteGroupEvidence: siteGroup?.reason ?? null,
    placeId: place.id, canonicalName: place.title, coordinates: { lat: place.lat, lon: place.lon },
    ...values, evidence, verifiedAt: EVIDENCE_DATE, reviewDueAt: dueAt,
    classification, classificationReason,
    nextReviewAction: classification === 'hold'
      ? (conflict?.decision === 'hold' ? '공식 원천의 장소 범위·요일·계절·프로그램 조건을 확인해 단일하게 파싱 가능한 운영시간으로 재검토한다.' : nextAction(place, classificationReason))
      : null,
  };
  const review = heldDiscoveryReviewById.get(place.id);
  // 재검토 결과도 일반 근거와 같은 만료 게이트를 통과해야 한다.
  if (!review || review.outcome === 'hold' || review.reviewDueAt < NOW) return applyTargetedSupplyReview(result, targetedSupplyReviewById.get(place.id));
  const isConditional = review.outcome === 'conditional_more';
  const activity = review.officialEvidence.activity;
  const stay = review.officialEvidence.stayTemplate;
  const availabilityEvidence = review.officialEvidence.availability;
  const maxStayMin = review.activityReview.activityType === 'compact_culture' ? 120 : 60;
  return applyTargetedSupplyReview({
    ...result,
    shortStayType: review.activityReview.activityType,
    minStayMin: 20,
    recommendedStayMin: 30,
    maxStayMin,
    dwellBasis: stay.sourceText,
    dwellReference: { kind: 'category_mode', category: place.category, mode: 30, ...CATEGORY_DWELL_REFERENCE[place.category], exactAihubMatch: false },
    identity: result.identity,
    activityEvidence: 'activity_template',
    stayEvidence: 'activity_template',
    availability: isConditional ? 'unknown' : 'fixed_hours',
    accessFriction: review.accessReview.value,
    evidence: [
      ...result.evidence.filter((item) => !['activityEvidence', 'stayEvidence', 'availability', 'accessFriction'].includes(item.field)),
      { field: 'activityEvidence', ...activity },
      { field: 'stayEvidence', ...stay },
      ...(isConditional ? [
        { field: 'availability', source: 'held_discovery_reverification', sourceIdOrUrl: place.id, sourceText: '운영 가능 시간의 적용 범위를 구조화하지 못함', retrievedAt: EVIDENCE_DATE, appliesTo: result.placeKind === 'area' ? 'area' : 'place' },
      ] : [{ field: 'availability', ...availabilityEvidence }]),
      { field: 'accessFriction', source: 'held_discovery_reverification', sourceIdOrUrl: place.id, sourceText: review.accessReview.reason, retrievedAt: EVIDENCE_DATE, appliesTo: result.placeKind === 'area' ? 'area' : 'place' },
    ],
    classification: review.outcome,
    classificationReason: review.decisionReason,
    reviewDueAt: review.reviewDueAt,
    nextReviewAction: review.nextReviewAction,
  }, targetedSupplyReviewById.get(place.id));
}

const data = all.map(classify).sort((a, b) => a.id.localeCompare(b.id, 'en'));
const baseline = { meta: { generatedAt: NOW, purpose: 'DATA-19~24 재분류 전 ID 기준선' }, summary: { total: all.length, active: active.length, review: decisions.review.length, excluded: decisions.excluded.length }, ids: all.map((p) => p.id).sort() };
const payload = { meta: { generatedAt: NOW, source: [ACTIVE, DECISIONS, HOURS], policy: 'evidence_profile_classification_v1' }, summary: { total: data.length, classification: countBy(data, (p) => p.classification), legacySelectionStatus: countBy(data, (p) => p.selectionStatus) }, data };
write(BASELINE, baseline); write(OUTPUT, payload);
console.log(`근거 프로필 재분류: ${data.length}개 ${JSON.stringify(payload.summary.classification)}`);
