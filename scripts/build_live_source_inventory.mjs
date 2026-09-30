#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const CATALOG = 'src/data/busan_poi_catalog.json';
const STRUCTURED_AVAILABILITY = 'data/processed/review/부산_장소_구조화_운영시간.json';
const PLACE_MAPPING_OUTPUT = 'data/processed/review/live_source_place_mapping_manifest.json';
const FIELD_OUTPUT = 'data/processed/review/live_source_field_provenance_manifest.json';
const FIXTURE_OUTPUT = 'data/processed/review/live_source_transition_minimal_fixture.json';
const AUDIT_OUTPUT = 'data/processed/review/live_source_inventory_audit.json';
const OFFICIAL_FILES = {
  busan_attraction: 'data/processed/부산시_명소정보.json',
  busan_food: 'data/processed/부산시_맛집정보.json',
  busan_shopping: 'data/processed/부산시_쇼핑정보.json',
};

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const countBy = (rows, selector) => rows.reduce((result, row) => {
  const key = selector(row);
  result[key] = (result[key] ?? 0) + 1;
  return result;
}, {});

const catalog = read(CATALOG);
const places = [...catalog.matched.data, ...catalog.unmatched.data]
  .sort((left, right) => left.contentId.localeCompare(right.contentId));
const structuredAvailabilityById = new Map(read(STRUCTURED_AVAILABILITY).data.map((row) => [row.placeId, row]));
const officialIds = Object.fromEntries(Object.entries(OFFICIAL_FILES).map(([source, file]) => {
  const payload = read(file);
  const rows = Array.isArray(payload) ? payload : payload.data ?? payload.items ?? [];
  return [source, new Set(rows.map((row) => String(row.UC_SEQ)))];
}));

function idsFor(place, source) {
  return (place.sourceEvidence ?? [])
    .filter((evidence) => evidence.source === source)
    .map((evidence) => String(evidence.sourceId))
    .sort();
}

function tourapiEvidence(place) {
  return (place.sourceEvidence ?? []).filter((evidence) => ['tourapi_aihub', 'tourapi_fallback'].includes(evidence.source));
}

function dispositionFor({ tourapiContentId, busanSourceIds, traditionalMarketSourceIds }) {
  const hasTourapi = Boolean(tourapiContentId);
  const hasBusan = Object.values(busanSourceIds).some((ids) => ids.length > 0);
  if (hasTourapi && hasBusan) return 'auto_join_exact_multi_source_conflict_policy_pending';
  if (hasTourapi) return 'auto_join_exact_tourapi';
  if (hasBusan) return 'auto_join_exact_busan_phase2';
  if (traditionalMarketSourceIds.length) return 'review_required_provider_out_of_scope';
  return 'forbidden_missing_source_identity';
}

const mappings = places.map((place) => {
  const tourapiRows = tourapiEvidence(place);
  const tourapiContentId = place.tourapiContentId ? String(place.tourapiContentId) : null;
  const busanSourceIds = Object.fromEntries(Object.keys(OFFICIAL_FILES).map((source) => [source, idsFor(place, source)]));
  const traditionalMarketSourceIds = idsFor(place, 'traditional_market_standard');
  const sourceCombination = [...new Set((place.sourceEvidence ?? []).map((evidence) => evidence.source))].sort();
  const mapping = {
    contentId: place.contentId,
    title: place.title,
    classification: place.classification,
    tourapiContentId,
    tourapiEvidenceKinds: tourapiRows.map((row) => row.source).sort(),
    busanSourceIds,
    traditionalMarketSourceIds,
    sourceCombination,
  };
  return { ...mapping, joinDisposition: dispositionFor(mapping) };
});

const sourceLinkRows = {
  tourapi: mappings.flatMap((row) => row.tourapiContentId ? [[row.contentId, row.tourapiContentId]] : []),
  busan_attraction: mappings.flatMap((row) => row.busanSourceIds.busan_attraction.map((id) => [row.contentId, id])),
  busan_food: mappings.flatMap((row) => row.busanSourceIds.busan_food.map((id) => [row.contentId, id])),
  busan_shopping: mappings.flatMap((row) => row.busanSourceIds.busan_shopping.map((id) => [row.contentId, id])),
  traditional_market_standard: mappings.flatMap((row) => row.traditionalMarketSourceIds.map((id) => [row.contentId, id])),
};

function reusedIds(rows) {
  const bySourceId = new Map();
  for (const [contentId, sourceId] of rows) bySourceId.set(sourceId, [...(bySourceId.get(sourceId) ?? []), contentId]);
  return [...bySourceId.entries()]
    .filter(([, contentIds]) => contentIds.length > 1)
    .map(([sourceId, contentIds]) => ({ sourceId, contentIds }));
}

const sourceSummary = Object.fromEntries(Object.entries(sourceLinkRows).map(([source, rows]) => [source, {
  links: rows.length,
  linkedPlaces: new Set(rows.map(([contentId]) => contentId)).size,
  uniqueSourceIds: new Set(rows.map(([, sourceId]) => sourceId)).size,
  reusedSourceIds: reusedIds(rows),
}]));
const withTourapi = mappings.filter((row) => row.tourapiContentId).length;
const withBusan = mappings.filter((row) => Object.values(row.busanSourceIds).some((ids) => ids.length)).length;
const withBoth = mappings.filter((row) => row.tourapiContentId && Object.values(row.busanSourceIds).some((ids) => ids.length)).length;

const placeMappingManifest = {
  meta: {
    taskId: 'DATA-LIVE-SOURCE-INVENTORY-01',
    contractVersion: 1,
    sourceCatalog: CATALOG,
    deterministic: true,
    note: '원천 ID exact mapping inventory. 이름·좌표 유사도로 새 연결을 만들지 않는다.',
  },
  summary: {
    runtimePlaces: mappings.length,
    uniqueInternalIds: new Set(mappings.map((row) => row.contentId)).size,
    targetProviderCoverage: {
      tourapi: withTourapi,
      busanOfficial: withBusan,
      bothTourapiAndBusan: withBoth,
      unionTourapiOrBusan: withTourapi + withBusan - withBoth,
      traditionalMarketOnly: mappings.filter((row) => row.joinDisposition === 'review_required_provider_out_of_scope').length,
    },
    joinDisposition: countBy(mappings, (row) => row.joinDisposition),
    sourceLinks: sourceSummary,
    sourceCombination: countBy(mappings, (row) => row.sourceCombination.join('+')),
    catalogBaseline: {
      classification: countBy(places, (row) => row.classification),
      displayOperatingHours: places.filter((row) => row.operatingHours?.length).length,
      structuredAvailability: places.filter((row) => structuredAvailabilityById.get(row.contentId)?.status === 'structured').length,
      displayOrStructuredAvailability: places.filter((row) => row.operatingHours?.length || structuredAvailabilityById.get(row.contentId)?.status === 'structured').length,
      detailDescription: places.filter((row) => row.detailDescription).length,
      photos: places.filter((row) => row.imageUrl).length,
      photoStatus: countBy(places.filter((row) => row.imageUrl), (row) => row.imageEvidence?.usagePermission?.status ?? 'missing'),
      subCategory: places.filter((row) => row.subCategory).length,
      siteGroupedPlaces: places.filter((row) => row.siteGroupId).length,
      uniqueSiteGroups: new Set(places.map((row) => row.siteGroupId).filter(Boolean)).size,
      reviewDueAt: places.filter((row) => row.evidenceProfile?.reviewDueAt).length,
    },
  },
  data: mappings,
};

const fieldRows = [
  ['contentId', 'app_derived', '검토 카탈로그의 내부 안정 ID', ['build_runtime_poi_catalog.mjs'], ['courseV1CandidateProvider', 'UI catalog lookup', 'routeProxyCatalogSnapshot'], '실시간 원천 ID와 분리해 유지'],
  ['title', 'source_live', '현재는 정제 snapshot의 장소명', ['부산_장소_근거프로필_재분류.json'], ['place detail', 'nearby browse', 'results/course screens'], '세션 snapshot의 최신 원천명 사용'],
  ['contentTypeId', 'mixed', 'TourAPI legacy 값 또는 앱 category fallback', ['build_runtime_poi_catalog.mjs'], ['legacy engine/data'], '원천 제공 여부와 fallback 의미를 분리해야 함'],
  ['contentTypeName', 'mixed', 'TourAPI legacy 이름 또는 앱 fallback 문구', ['build_runtime_poi_catalog.mjs'], ['legacy engine/data'], '사용 여부 확인 뒤 원천/앱 필드 분리'],
  ['category', 'app_derived', '짜투리 활동·개인화 분류', ['부산_장소_근거프로필_재분류.json'], ['courseV1CandidateProvider', 'detail/nearby/results UI'], '실시간 응답으로 자동 재분류 금지'],
  ['subCategory', 'app_derived', '기존 scope/검토된 공식 subtitle 기반 로컬 분류', ['build_runtime_poi_catalog.mjs', '카페문화시설_세부분류_감사.json'], ['courseV1CandidateProvider', 'detail/nearby UI'], '명칭만으로 추정 금지'],
  ['availabilityProfile', 'app_derived', '장소 성격별 운영시간 게이트 프로필', ['build_runtime_poi_catalog.mjs'], ['legacy engine/data'], '시설/권역/야외 의미 유지'],
  ['addr1', 'source_live', '현재는 공식 원천 snapshot 주소', ['부산_장소_근거프로필_재분류.json'], ['detail/nearby/activity UI', 'Kakao search fallback'], '세션 snapshot 최신 주소 사용'],
  ['lat', 'source_live', '현재는 공식 원천 snapshot 좌표', ['부산_장소_근거프로필_재분류.json'], ['candidate provider', 'route/map/detail/nearby'], '유효성 검증 후 사용; 급변은 충돌 대기'],
  ['lon', 'source_live', '현재는 공식 원천 snapshot 좌표', ['부산_장소_근거프로필_재분류.json'], ['candidate provider', 'route/map/detail/nearby'], '유효성 검증 후 사용; 급변은 충돌 대기'],
  ['aliases', 'app_derived', '중복 정제 과정의 별칭', ['부산_장소_근거프로필_재분류.json'], ['catalog identity audit'], '실시간 이름으로 자동 삭제 금지'],
  ['mergedPlaceIds', 'app_derived', '중복 병합 이력', ['부산_장소_근거프로필_재분류.json'], ['catalog identity audit'], '원천 수정과 무관하게 유지'],
  ['siteGroupId', 'app_derived', '동일 단지·중복 관계 키', ['부산_장소_근거프로필_재분류.json'], ['courseV1CandidateProvider', 'courseV1 relationship gate'], '자동 코스 중복 제외를 위해 유지'],
  ['siteRole', 'app_derived', '동일 단지 내부 역할 optional', ['부산_장소_근거프로필_재분류.json'], ['courseV1CandidateProvider'], 'internal 역할 자동 추천 금지'],
  ['sourceEvidence', 'app_derived', '내부 ID와 공식 원천 ID exact 연결 및 검토 근거', ['부산_장소_근거프로필_재분류.json'], ['build_runtime_poi_catalog.mjs', 'audit scripts'], 'live join의 단일 identity 근거로 유지'],
  ['detailDescription', 'source_live', '현재는 부산 공식 설명의 정규화 snapshot', ['build_place_detail_description.mjs', 'build_runtime_poi_catalog.mjs'], ['place detail', 'nearby browse'], '실시간 원문 검증·정규화 후 optional 사용'],
  ['tourapiContentId', 'app_derived', '내부 ID↔TourAPI content ID exact mapping', ['build_runtime_poi_catalog.mjs'], ['live join', 'legacy engine/data'], '신규 ID 자동 승격 금지'],
  ['tourapiContentTypeId', 'mixed', 'TourAPI legacy content type snapshot', ['build_runtime_poi_catalog.mjs'], ['legacy engine/data'], '실시간 제공값과 기존 fallback의 우선순위 결정 필요'],
  ['matchScope', 'app_derived', '직접 장소/권역/카테고리 fallback 판정', ['build_runtime_poi_catalog.mjs'], ['legacy engine/data'], '실시간 필드로 완화 금지'],
  ['dwellSourceName', 'app_derived', 'AI-Hub/정책 체류 근거 이름', ['build_runtime_poi_catalog.mjs'], ['legacy engine/data'], '유지'],
  ['openingHoursSourceName', 'app_derived', '운영시간 표시 근거 연결용 장소명', ['build_runtime_poi_catalog.mjs'], ['legacy engine/data'], '실시간 시간과 provenance를 분리할지 결정 필요'],
  ['openingHoursReliability', 'app_derived', '운영시간 신뢰도 판정', ['build_runtime_poi_catalog.mjs'], ['legacy engine/planner'], '원천 시간 누락을 direct로 합성 금지'],
  ['operatingHours', 'source_live', '현재는 공식 원천 운영시간 snapshot', ['부산_장소_근거프로필_재분류.json', '부산_장소_구조화_운영시간.json'], ['candidate provider availability', 'detail/nearby UI', 'opening gate'], '원문과 구조화 결과를 세션 snapshot에 결합'],
  ['mapVerification', 'app_derived', 'Kakao 별도 검증·연결 결과', ['build_runtime_poi_catalog.mjs'], ['detail/nearby/results Kakao handoff', 'legacy engine'], 'TourAPI 실시간 사실로 덮지 않음'],
  ['shortStay', 'app_derived', '최소·권장·최대 체류와 활동 유형', ['부산_장소_근거프로필_재분류.json', 'AI-Hub category statistics'], ['courseV1CandidateProvider', 'engine/data', 'detail UI'], '실시간 응답으로 기본값 합성·변경 금지'],
  ['classification', 'app_derived', '대표/조건부 추천 자격', ['부산_장소_근거프로필_재분류.json'], ['courseV1CandidateProvider', 'nearby UI'], '신규·수정 원천으로 자동 승격 금지'],
  ['classificationReason', 'app_derived', '추천 자격 검토 이유', ['부산_장소_근거프로필_재분류.json'], ['audit only'], '유지'],
  ['discovery', 'app_derived', '대표/area_access/conditional 발견 계약', ['권역형_발견후보_감사.json', 'build_runtime_poi_catalog.mjs'], ['courseV1CandidateProvider', 'courseV1 exploration'], '누락 시 conditional fail-closed'],
  ['conditionalVisit', 'app_derived', '시장·거리 정보 확인용 10:00–18:00 제품 창', ['조건부_시장거리_발견후보_감사.json', 'build_runtime_poi_catalog.mjs'], ['courseV1CandidateProvider', 'courseV1 conditional flow'], '실제 영업시간으로 해석 금지'],
  ['evidenceProfile', 'app_derived', '동일성·활동·체류·가용성·재검토 근거', ['부산_장소_근거프로필_재분류.json'], ['courseV1CandidateProvider review gate', 'discovery mapping'], 'verifiedAt/reviewDueAt 포함 유지'],
  ['aihubName', 'app_derived', '정확 매칭된 AI-Hub 장소명', ['부산_장소_근거프로필_재분류.json'], ['legacy engine/data'], '분석 근거로 유지'],
  ['aihubCategory', 'app_derived', 'AI-Hub 체류 통계 연결 카테고리', ['부산_장소_근거프로필_재분류.json'], ['legacy engine/data'], '실시간 분류로 교체 금지'],
  ['matchType', 'app_derived', 'AI-Hub 매칭 방식', ['부산_장소_근거프로필_재분류.json'], ['legacy engine/data'], '유지'],
  ['matchDistanceM', 'app_derived', 'AI-Hub 매칭 거리', ['부산_장소_근거프로필_재분류.json'], ['legacy engine/data'], '유지'],
  ['dwell', 'app_derived', 'AI-Hub 장소별 체류 통계', ['부산_장소_근거프로필_재분류.json'], ['legacy engine/data'], '실시간 응답으로 교체 금지'],
  ['imageUrl', 'mixed', '원천 URL + 사진 권리/운영자 승인 gate', ['build_public_api_photo_permissions.mjs', 'runtime_image_permission.mjs', 'build_runtime_poi_catalog.mjs'], ['placePhotoModel', 'cards/detail/maps'], '새 URL은 권리 상태 없으면 fallback'],
  ['imageSource', 'app_derived', '사진 공급 원천 표식', ['build_runtime_poi_catalog.mjs'], ['placePhotoModel'], '실제 공급자와 exact 유지'],
  ['imageEvidence', 'mixed', '원천 ID·HTTPS 도달성·권리/운영자 승인 metadata', ['runtime_image_permission.mjs', '사진_이용허락_허용목록.json'], ['placePhotoModel', 'photo credit'], '실시간 URL과 별도 유지'],
].map(([field, ownership, currentOrigin, generators, consumers, transitionRule]) => ({
  field, ownership, currentMode: 'bundled_snapshot', currentOrigin, generators, consumers, transitionRule,
  presentCount: places.filter((place) => place[field] !== undefined).length,
}));

const currentFields = [...new Set(places.flatMap((place) => Object.keys(place)))].sort();
const coveredFields = new Set(fieldRows.map((row) => row.field));
const uncoveredFields = currentFields.filter((field) => !coveredFields.has(field));
const fieldManifest = {
  meta: {
    taskId: 'DATA-LIVE-SOURCE-INVENTORY-01',
    contractVersion: 1,
    ownershipValues: ['source_live', 'app_derived', 'mixed', 'unresolved'],
    currentCatalogMode: 'bundled_snapshot',
    note: 'ownership은 전환 뒤 책임 분류이며 currentMode는 현재 번들 snapshot 상태를 별도로 기록한다.',
  },
  summary: {
    runtimeFieldCount: currentFields.length,
    manifestFieldCount: fieldRows.length,
    uncoveredRuntimeFields: uncoveredFields,
    byOwnership: countBy(fieldRows, (row) => row.ownership),
  },
  data: fieldRows,
};

const fixture = {
  meta: {
    taskId: 'DATA-LIVE-SOURCE-INVENTORY-01',
    contractVersion: 1,
    kind: 'normalized_provider_boundary_fixture_design',
    containsRealApiResponse: false,
    containsSecret: false,
    note: 'API별 raw schema가 아니라 A2 adapter 이후 정규화 경계를 검증하기 위한 최소 fixture다.',
  },
  cases: [
    {
      id: 'LIVE-SOURCE-UNCHANGED-01', scenario: 'existing_unchanged', local: { contentId: 'fixture_place_existing', sourceId: 'fixture-source-100', classification: 'representative_standard', recommendedStayMin: 30 },
      live: { provider: 'tourapi', sourceId: 'fixture-source-100', availability: 'available', title: 'Fixture Place', addr1: '부산광역시 테스트구', lat: 35.1, lon: 129.1, operatingHours: ['10:00-18:00'], modifiedAt: '2026-09-20T00:00:00Z' },
      expected: { disposition: 'join', liveFieldsUpdated: false, appDerivedFieldsPreserved: true },
    },
    {
      id: 'LIVE-SOURCE-MODIFIED-01', scenario: 'existing_modified', local: { contentId: 'fixture_place_modified', sourceId: 'fixture-source-200', classification: 'representative_standard', recommendedStayMin: 30 },
      live: { provider: 'tourapi', sourceId: 'fixture-source-200', availability: 'available', title: 'Fixture Place Renamed', addr1: '부산광역시 변경구', lat: 35.11, lon: 129.11, operatingHours: ['11:00-19:00'], modifiedAt: '2026-09-21T00:00:00Z' },
      expected: { disposition: 'join', liveFieldsUpdated: true, appDerivedFieldsPreserved: true },
    },
    {
      id: 'LIVE-SOURCE-DELETED-01', scenario: 'existing_deleted', local: { contentId: 'fixture_place_deleted', sourceId: 'fixture-source-300', classification: 'representative_core', recommendedStayMin: 30 },
      live: { provider: 'tourapi', sourceId: 'fixture-source-300', availability: 'deleted', modifiedAt: '2026-09-21T00:00:00Z' },
      expected: { disposition: 'exclude_session', localFallbackAllowed: false },
    },
    {
      id: 'LIVE-SOURCE-NEW-01', scenario: 'new_source_id', local: null,
      live: { provider: 'tourapi', sourceId: 'fixture-source-new', availability: 'available', title: 'New Fixture Place', addr1: '부산광역시 신규구', lat: 35.12, lon: 129.12, operatingHours: ['10:00-17:00'], modifiedAt: '2026-09-21T00:00:00Z' },
      expected: { disposition: 'review_required', autoPromote: false, synthesizedDwellAllowed: false },
    },
    {
      id: 'LIVE-SOURCE-ID-REUSE-01', scenario: 'source_id_reuse_or_identity_conflict', local: { contentId: 'fixture_place_conflict', sourceId: 'fixture-source-400', title: 'Original Fixture Place', lat: 35.1, lon: 129.1, classification: 'representative_standard', recommendedStayMin: 30 },
      live: { provider: 'tourapi', sourceId: 'fixture-source-400', availability: 'available', title: 'Different Fixture Entity', addr1: '부산광역시 충돌구', lat: 36.1, lon: 128.1, operatingHours: ['09:00-18:00'], modifiedAt: '2026-09-21T00:00:00Z' },
      expected: { disposition: 'conflict_review', autoJoin: false, thresholdDecisionRequired: true },
    },
    {
      id: 'LIVE-SOURCE-IMAGE-RIGHTS-01', scenario: 'new_image_without_rights_mapping', local: { contentId: 'fixture_place_image', sourceId: 'fixture-source-500', classification: 'representative_standard', recommendedStayMin: 30 },
      live: { provider: 'tourapi', sourceId: 'fixture-source-500', availability: 'available', title: 'Image Fixture Place', imageUrl: 'https://example.invalid/new-image.jpg', modifiedAt: '2026-09-21T00:00:00Z' },
      expected: { disposition: 'join', placeRetained: true, imageDisposition: 'fallback', rightsInferredFromReachability: false },
    },
  ],
};

assert.equal(places.length, 369, 'runtime place count changed');
assert.equal(new Set(places.map((place) => place.contentId)).size, 369, 'internal contentId must be unique');
assert.equal(withTourapi, 139, 'TourAPI mapping count changed');
assert.equal(withBusan, 132, 'Busan official mapping count changed');
assert.equal(withBoth, 20, 'TourAPI/Busan overlap count changed');
assert.equal(withTourapi + withBusan - withBoth, 251, 'target provider union changed');
assert.equal(mappings.filter((row) => row.joinDisposition === 'review_required_provider_out_of_scope').length, 118, 'traditional-market-only count changed');
assert.equal(mappings.filter((row) => row.joinDisposition === 'forbidden_missing_source_identity').length, 0, 'source identity missing');
assert.deepEqual(Object.fromEntries(Object.entries(sourceSummary).map(([source, summary]) => [source, summary.reusedSourceIds.length])), {
  tourapi: 0, busan_attraction: 0, busan_food: 0, busan_shopping: 0, traditional_market_standard: 0,
});
for (const mapping of mappings) {
  const place = places.find((row) => row.contentId === mapping.contentId);
  const tourapiRows = tourapiEvidence(place);
  assert.equal(tourapiRows.length, mapping.tourapiContentId ? 1 : 0, `${mapping.contentId}: TourAPI evidence cardinality`);
  if (mapping.tourapiContentId) assert.equal(String(tourapiRows[0].sourceId), mapping.tourapiContentId, `${mapping.contentId}: TourAPI ID mismatch`);
  for (const source of Object.keys(OFFICIAL_FILES)) {
    for (const sourceId of mapping.busanSourceIds[source]) assert.ok(officialIds[source].has(sourceId), `${mapping.contentId}: ${source}/${sourceId} missing in stored official source`);
  }
}
assert.deepEqual(uncoveredFields, [], `field provenance missing: ${uncoveredFields.join(', ')}`);
assert.deepEqual(fixture.cases.map((row) => row.scenario), [
  'existing_unchanged', 'existing_modified', 'existing_deleted', 'new_source_id', 'source_id_reuse_or_identity_conflict', 'new_image_without_rights_mapping',
]);

const audit = {
  meta: { taskId: 'DATA-LIVE-SOURCE-INVENTORY-01', contractVersion: 1, externalCalls: 0 },
  checks: {
    runtimeCountExact: true,
    internalIdsUnique: true,
    allPlacesHaveSourceIdentity: true,
    tourapiEvidenceExact: true,
    busanStoredSourceIdsResolve: true,
    sourceIdsNotReusedWithinProvider: true,
    allRuntimeFieldsClassified: true,
    minimalTransitionFixturesPresent: true,
  },
  counts: placeMappingManifest.summary,
  hashes: {
    placeMappingSha256: hash(mappings),
    fieldProvenanceSha256: hash(fieldRows),
    fixtureSha256: hash(fixture.cases),
  },
};

write(PLACE_MAPPING_OUTPUT, placeMappingManifest);
write(FIELD_OUTPUT, fieldManifest);
write(FIXTURE_OUTPUT, fixture);
write(AUDIT_OUTPUT, audit);
console.log(JSON.stringify({
  runtimePlaces: mappings.length,
  targetProviderCoverage: placeMappingManifest.summary.targetProviderCoverage,
  joinDisposition: placeMappingManifest.summary.joinDisposition,
  fields: fieldManifest.summary,
  fixtureCases: fixture.cases.length,
  externalCalls: 0,
}, null, 2));
