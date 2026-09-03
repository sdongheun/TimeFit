#!/usr/bin/env node
// 기존 근거 프로필만 사용해 권역형 장소의 탐색 자격을 감사한다.
// 네트워크 호출·등급 재분류·운영시간 재파싱은 이 경계의 책임이 아니다.
import fs from 'node:fs';

const SOURCE = 'data/processed/review/부산_장소_근거프로필_재분류.json';
const OUTPUT = 'data/processed/review/권역형_발견후보_감사.json';
const ACTIVE_CLASSIFICATIONS = new Set(['representative_core', 'representative_standard', 'conditional_more']);
const PUBLIC_OUTDOOR_SCOPE_KINDS = new Set(['해변·해안', '공원·정원']);

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const countBy = (rows, selector) => rows.reduce((result, row) => {
  const key = selector(row) ?? 'unknown';
  result[key] = (result[key] ?? 0) + 1;
  return result;
}, {});

function publicOutdoorAccess(place) {
  if (place.placeKind !== 'area' || place.shortStayType !== 'scenic_pause' || !PUBLIC_OUTDOOR_SCOPE_KINDS.has(place.scope?.kind)) return null;
  const availability = (place.evidence ?? []).find((item) => item.field === 'availability'
    && item.source === 'busan_attraction'
    && item.appliesTo === 'area'
    && typeof item.sourceText === 'string');
  if (!availability) return null;

  const raw = availability.sourceText.replace(/\s+/g, ' ').trim();
  // 원문이 권역 자체의 상시 접근을 명시할 때만 인정한다. 부대시설의 계절·프로그램
  // 시간은 접근 창으로 상속하지 않는다.
  const compactRaw = raw.replace(/\s+/g, '');
  const compactTitle = place.title.replace(/\s+/g, '');
  const isExplicitAreaDailyAccess = raw === '매일' || compactRaw.startsWith(`${compactTitle}:매일`);
  if (!isExplicitAreaDailyAccess) return null;

  return {
    status: 'public_outdoor_access',
    source: availability.source,
    sourceId: availability.sourceIdOrUrl,
    checkedAt: availability.retrievedAt,
    sourceText: availability.sourceText,
    accessWindow: { kind: 'always', dayTypes: ['weekday', 'weekend'], windows: [] },
    note: '대표 권역의 공개 야외 접근 근거이며 내부 유료·계절·프로그램 시설에는 적용하지 않는다.',
  };
}

function conditionalReason(place) {
  if (place.placeKind === 'point_facility') return 'facility_requires_structured_availability';
  if (place.placeKind === 'outdoor_route') return 'public_outdoor_access_evidence_missing';
  return 'area_access_evidence_missing_or_ambiguous';
}

const source = read(SOURCE);
const data = source.data
  .filter((place) => ACTIVE_CLASSIFICATIONS.has(place.classification))
  .map((place) => {
    const representative = place.classification === 'representative_core' || place.classification === 'representative_standard';
    const access = representative ? null : publicOutdoorAccess(place);
    const discoveryEligibility = representative ? 'representative' : access ? 'area_access' : 'conditional';
    return {
      contentId: place.id,
      title: place.title,
      previousClassification: place.classification,
      discoveryEligibility,
      placeKind: place.placeKind,
      areaCharacter: place.scope?.kind ?? null,
      siteGroupId: place.siteGroupId ?? null,
      accessEvidence: access ? {
        status: access.status,
        source: access.source,
        sourceId: access.sourceId,
        checkedAt: access.checkedAt,
        sourceText: access.sourceText,
        note: access.note,
      } : null,
      accessWindow: access?.accessWindow ?? null,
      exclusionReason: discoveryEligibility === 'conditional' ? conditionalReason(place) : null,
    };
  })
  .sort((left, right) => left.contentId.localeCompare(right.contentId));

write(OUTPUT, {
  meta: {
    generatedAt: new Date().toISOString(),
    source: SOURCE,
    method: '기존 근거 프로필의 공식 권역 시간·공개 야외 접근 원문만 사용한 무호출 감사',
    policy: '대표 등급은 representative로 보존하고, conditional은 공식 공개 야외 접근 근거가 있을 때만 area_access로 분리한다.',
  },
  summary: {
    total: data.length,
    discoveryEligibility: countBy(data, (row) => row.discoveryEligibility),
    byPlaceKind: countBy(data, (row) => row.placeKind),
    areaAccessByCharacter: countBy(data.filter((row) => row.discoveryEligibility === 'area_access'), (row) => row.areaCharacter),
    conditionalByReason: countBy(data.filter((row) => row.discoveryEligibility === 'conditional'), (row) => row.exclusionReason),
  },
  data,
});

console.log(`권역형 발견 후보 감사: ${data.length}개 / representative ${data.filter((row) => row.discoveryEligibility === 'representative').length} / area_access ${data.filter((row) => row.discoveryEligibility === 'area_access').length} / conditional ${data.filter((row) => row.discoveryEligibility === 'conditional').length}`);
