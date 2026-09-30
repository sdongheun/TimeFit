#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const CATALOG = 'src/data/busan_poi_catalog.json';
const LEGACY_TOURAPI = 'src/data/busan_poi_catalog.legacy.json';
const SOURCE_MAPPING = 'data/processed/review/live_source_place_mapping_manifest.json';
const CONTRACT_OUTPUT = 'data/processed/review/live_source_overlap_field_contract.json';
const FIXTURE_OUTPUT = 'data/processed/review/live_source_mapping_transition_fixture.json';
const AUDIT_OUTPUT = 'data/processed/review/live_source_mapping_contract_audit.json';
const BUSAN_FILES = {
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
const normalizeText = (value) => String(value ?? '')
  .normalize('NFKC')
  .toLocaleLowerCase('ko-KR')
  .replace(/[\p{P}\p{S}\s]/gu, '');
const normalizeAddress = (value) => normalizeText(value).replace(/부산광역시/g, '부산');

function distanceM(left, right) {
  if (![left?.lat, left?.lon, right?.lat, right?.lon].every(Number.isFinite)) return null;
  const radians = Math.PI / 180;
  const dLat = (right.lat - left.lat) * radians;
  const dLon = (right.lon - left.lon) * radians;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(left.lat * radians) * Math.cos(right.lat * radians) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371000 * 2 * Math.asin(Math.sqrt(a)));
}

function busanIdentityTitle(row) {
  return row.PLACE || row.MAIN_PLACE || row.MAIN_TITLE || row.TITLE || '';
}

function titleRelation(place, sourceTitle) {
  const normalizedSource = normalizeText(sourceTitle);
  if (normalizedSource === normalizeText(place.title)) return 'exact_normalized_title';
  if ((place.aliases ?? []).some((alias) => normalizeText(alias) === normalizedSource)) return 'known_reviewed_alias';
  return 'different_title_review_required';
}

const catalog = read(CATALOG);
const places = [...catalog.matched.data, ...catalog.unmatched.data]
  .sort((left, right) => left.contentId.localeCompare(right.contentId));
const placeById = new Map(places.map((place) => [place.contentId, place]));
const legacyCatalog = read(LEGACY_TOURAPI);
const legacyTourapiRows = [...legacyCatalog.matched.data, ...legacyCatalog.unmatched.data];
const legacyTourapiById = new Map(legacyTourapiRows.map((row) => [String(row.contentId), row]));
const sourceMappings = read(SOURCE_MAPPING).data;
const overlaps = sourceMappings
  .filter((row) => row.tourapiContentId && Object.values(row.busanSourceIds).some((ids) => ids.length))
  .sort((left, right) => left.contentId.localeCompare(right.contentId));
const busanRowsByProvider = Object.fromEntries(Object.entries(BUSAN_FILES).map(([provider, file]) => {
  const rows = read(file).data;
  return [provider, new Map(rows.map((row) => [String(row.UC_SEQ), row]))];
}));

const overlapRows = overlaps.map((mapping) => {
  const place = placeById.get(mapping.contentId);
  const tourapi = legacyTourapiById.get(String(mapping.tourapiContentId));
  assert.ok(place, `${mapping.contentId}: runtime place missing`);
  assert.ok(tourapi, `${mapping.contentId}: stored TourAPI snapshot missing`);

  const busanSnapshots = Object.entries(mapping.busanSourceIds).flatMap(([provider, sourceIds]) => sourceIds.map((sourceId) => {
    const row = busanRowsByProvider[provider].get(String(sourceId));
    assert.ok(row, `${mapping.contentId}: ${provider}/${sourceId} missing`);
    const identityTitle = busanIdentityTitle(row);
    return {
      provider,
      sourceId: String(sourceId),
      mainTitle: row.MAIN_TITLE || null,
      identityTitle,
      addr1: row.ADDR1 || null,
      lat: Number.isFinite(row.LAT) ? row.LAT : null,
      lon: Number.isFinite(row.LNG) ? row.LNG : null,
      operatingHoursText: row.USAGE_DAY_WEEK_AND_TIME || null,
      holidayText: row.HLDY_INFO || null,
      detailDescriptionPresent: Boolean(String(row.ITEMCNTNTS ?? '').trim()),
      imageUrlPresent: Boolean(row.MAIN_IMG_NORMAL || row.MAIN_IMG_THUMB),
      comparisonToRuntime: {
        titleRelation: titleRelation(place, identityTitle),
        addressNormalizedExact: normalizeAddress(place.addr1) === normalizeAddress(row.ADDR1),
        coordinateDistanceM: distanceM(place, { lat: row.LAT, lon: row.LNG }),
      },
    };
  })).sort((left, right) => `${left.provider}:${left.sourceId}`.localeCompare(`${right.provider}:${right.sourceId}`));

  const tourapiStoredSnapshot = {
    provider: 'tourapi',
    sourceId: String(tourapi.contentId),
    title: tourapi.title,
    addr1: tourapi.addr1,
    lat: tourapi.lat,
    lon: tourapi.lon,
    contentTypeId: String(tourapi.contentTypeId),
    comparisonToRuntime: {
      titleNormalizedExact: normalizeText(place.title) === normalizeText(tourapi.title),
      addressNormalizedExact: normalizeAddress(place.addr1) === normalizeAddress(tourapi.addr1),
      coordinateDistanceM: distanceM(place, tourapi),
      contentTypeExact: String(place.tourapiContentTypeId ?? place.contentTypeId) === String(tourapi.contentTypeId),
    },
  };

  return {
    contentId: mapping.contentId,
    runtimeTitle: place.title,
    classification: place.classification,
    sourceIds: {
      tourapi: String(mapping.tourapiContentId),
      busan: busanSnapshots.map(({ provider, sourceId }) => ({ provider, sourceId })),
    },
    internalIdentityRelations: {
      aliases: place.aliases ?? [],
      mergedPlaceIds: place.mergedPlaceIds ?? [],
      siteGroupId: place.siteGroupId ?? null,
      siteRole: place.siteRole ?? null,
    },
    storedSnapshots: { tourapi: tourapiStoredSnapshot, busan: busanSnapshots },
    existingMappingAssessment: {
      disposition: 'preserve_reviewed_exact_source_links',
      tourapiSnapshotExactlyMatchesRuntimeCommonFields: Object.values(tourapiStoredSnapshot.comparisonToRuntime)
        .every((value) => value === true || value === 0),
      busanTitlesResolveByReviewedTitleOrAlias: busanSnapshots
        .every((row) => row.comparisonToRuntime.titleRelation !== 'different_title_review_required'),
      maxBusanCoordinateDistanceM: Math.max(...busanSnapshots.map((row) => row.comparisonToRuntime.coordinateDistanceM ?? 0)),
      freshnessClaim: 'none_stored_snapshots_only',
    },
    phase1Resolution: {
      tourapiLifecycle: 'apply_complete_live_list_membership_active_or_inactive_and_modified_fact_after_identity_gate',
      tourapiCommonFields: 'overlay_only_fields_present_in_accepted_live_response',
      busanCommonFields: 'retain_as_stored_provenance_but_do_not_override_tourapi_phase1_or_claim_latest',
      busanOnlyFields: 'preserve_existing_reviewed_snapshot_value_and_provenance',
      appDerivedFields: 'preserve_without_live_reclassification',
      photos: 'preserve_existing_rights_gate_new_or_changed_url_falls_back_until_exact_permission_mapping',
    },
  };
});

const fieldContract = [
  {
    fields: ['contentId'], ownership: 'app_stable_identity',
    tourapiPhase1: 'preserve', busanStoredSnapshot: 'preserve',
    conflictResolution: 'never_replace_internal_id_with_provider_id',
  },
  {
    fields: ['tourapiContentId', 'sourceEvidence'], ownership: 'reviewed_identity_mapping',
    tourapiPhase1: 'exact_join_key_only', busanStoredSnapshot: 'exact_join_key_only',
    conflictResolution: 'new_or_reused_source_id_requires_review_no_similarity_auto_join',
  },
  {
    fields: ['availability', 'deleted', 'modifiedAt'], ownership: 'tourapi_live_lifecycle_phase1',
    tourapiPhase1: 'derive_active_or_inactive_only_from_a_complete_area_list_and_apply_modifiedAt_when_present', busanStoredSnapshot: 'not_a_freshness_signal',
    conflictResolution: 'complete_list_confirmed_inactive_excludes_tourapi_linked_place_from_session_no_static_resurrection',
  },
  {
    fields: ['title', 'addr1', 'lat', 'lon'], ownership: 'provider_fact_with_identity_gate',
    tourapiPhase1: 'overlay_present_live_value_only_after_identity_acceptance', busanStoredSnapshot: 'retain_with_static_snapshot_provenance',
    conflictResolution: 'phase1_tourapi_value_is_session_fact_busan_value_is_not_called_latest',
  },
  {
    fields: ['contentTypeId', 'tourapiContentTypeId'], ownership: 'tourapi_fact_plus_legacy_compatibility',
    tourapiPhase1: 'overlay_present_live_value_only_after_identity_acceptance', busanStoredSnapshot: 'not_applicable',
    conflictResolution: 'type_change_requires_review_and_never_changes_app_category_automatically',
  },
  {
    fields: ['operatingHours'], ownership: 'provider_fact_separate_from_product_window',
    tourapiPhase1: 'use_only_when_selected_operation_returns_a_current_value', busanStoredSnapshot: 'preserve_as_static_snapshot_not_latest',
    conflictResolution: 'do_not_merge_texts_or_substitute_conditionalVisit_or_access_window',
  },
  {
    fields: ['detailDescription'], ownership: 'busan_reviewed_snapshot_phase1',
    tourapiPhase1: 'do_not_erase_or_synthesize', busanStoredSnapshot: 'preserve_existing_value_and_exact_source_provenance',
    conflictResolution: 'busan_only_field_survives_tourapi_overlay_but_has_no_live_freshness_claim',
  },
  {
    fields: ['category', 'subCategory', 'availabilityProfile'], ownership: 'app_derived_policy',
    tourapiPhase1: 'preserve', busanStoredSnapshot: 'preserve',
    conflictResolution: 'provider_title_or_type_never_reclassifies_automatically',
  },
  {
    fields: ['shortStay', 'dwell', 'dwellSourceName', 'aihubName', 'aihubCategory', 'matchType', 'matchDistanceM'], ownership: 'app_derived_dwell_evidence',
    tourapiPhase1: 'preserve', busanStoredSnapshot: 'preserve',
    conflictResolution: 'never_synthesize_or_replace_from_live_place_fact',
  },
  {
    fields: ['classification', 'classificationReason', 'discovery', 'conditionalVisit', 'evidenceProfile'], ownership: 'app_derived_recommendation_eligibility',
    tourapiPhase1: 'preserve_except_session_exclusion_on_explicit_delete_or_invalid_identity', busanStoredSnapshot: 'preserve',
    conflictResolution: 'no_live_auto_promotion_or_grade_change',
  },
  {
    fields: ['aliases', 'mergedPlaceIds', 'siteGroupId', 'siteRole'], ownership: 'app_derived_identity_relationship',
    tourapiPhase1: 'preserve_and_use_for_identity_review', busanStoredSnapshot: 'preserve',
    conflictResolution: 'live_match_to_other_internal_relation_requires_review_no_relink',
  },
  {
    fields: ['imageUrl', 'imageSource', 'imageEvidence'], ownership: 'provider_url_plus_separate_rights_gate',
    tourapiPhase1: 'retain_only_exactly_permission_mapped_url_otherwise_default_image', busanStoredSnapshot: 'retain_only_exactly_permission_mapped_url',
    conflictResolution: 'reachability_or_provider_identity_does_not_infer_photo_permission',
  },
  {
    fields: ['mapVerification'], ownership: 'app_derived_kakao_contract',
    tourapiPhase1: 'preserve', busanStoredSnapshot: 'preserve',
    conflictResolution: 'never_overwrite_from_tourapi_or_busan_fact',
  },
];

const reviewRules = {
  status: 'proposed_data_contract_for_adapter_tests_not_product_code',
  normalization: {
    title: 'NFKC + lowercase + remove whitespace/punctuation/symbols; reviewed aliases are exact normalized alternatives',
    coordinateDistance: 'haversine_meters',
  },
  autoApplyAllRequired: [
    'provider source ID exactly equals the reviewed mapping',
    'normalized live title equals current title or one reviewed alias',
    'live coordinate is valid and no more than 100m from the mapped place when coordinates are returned',
    'contentTypeId is unchanged when returned',
    'source ID still maps to the same internal contentId and not another merged/site-group relation',
  ],
  reviewRequiredIfAny: [
    'normalized live title is neither current title nor a reviewed alias',
    'coordinate movement exceeds 100m',
    'contentTypeId changes',
    'same provider source ID resolves to multiple internal IDs',
    'live identity is closer to or names another mergedPlaceId/siteGroup member instead of the mapped contentId',
  ],
  probableIdReuseSignals: [
    'unknown title and coordinate movement exceeds 250m',
    'coordinate movement exceeds 1000m even when title is retained',
    'contentTypeId changes together with unknown title or coordinate movement',
  ],
  reviewDisposition: 'keep_mapping_unchanged_exclude_conflicting_live_overlay_from_session_and_emit_review_record',
  partialResponseRule: 'missing optional field does not erase stored value; only complete-list-confirmed inactive membership removes the TourAPI-linked place from the session; detail failure is not deletion',
  scopeNote: 'These thresholds are audit proposals for adapter fixtures. They are not recommendation policy and are not written into UI, engine, API adapter, or DB code by this task.',
};

const fixture = {
  meta: {
    taskId: 'DATA-LIVE-MAPPING-CONTRACT-02',
    contractVersion: 1,
    kind: 'normalized_mapping_boundary_fixture',
    containsRealApiResponse: false,
    containsSecret: false,
    thresholdsReference: reviewRules.status,
  },
  cases: [
    {
      id: 'LIVE-MAP-NEW-01', scenario: 'new_source_id', local: null,
      live: { provider: 'tourapi', sourceId: 'fixture-new-100', availability: 'active', title: '신규 테스트 장소', lat: 35.1, lon: 129.1, contentTypeId: '12' },
      expected: { disposition: 'review_required', autoJoin: false, autoClassification: false, synthesizedDwellAllowed: false },
    },
    {
      id: 'LIVE-MAP-DELETED-01', scenario: 'existing_source_confirmed_inactive_or_deleted',
      local: { contentId: 'fixture-place-200', sourceId: 'fixture-200', classification: 'representative_standard' },
      live: { provider: 'tourapi', sourceId: 'fixture-200', availability: 'inactive', lifecycleEvidence: 'absent_from_complete_area_list', fetchedAt: '2026-09-21T00:00:00Z' },
      expected: { disposition: 'exclude_session', staticResurrectionAllowed: false, appDerivedDataDeleted: false },
    },
    {
      id: 'LIVE-MAP-TITLE-ALIAS-01', scenario: 'existing_source_title_changes_to_reviewed_alias',
      local: { contentId: 'fixture-place-300', sourceId: 'fixture-300', title: '테스트 공원', aliases: ['테스트 공원', '테스트섬'], lat: 35.1, lon: 129.1, contentTypeId: '12', classification: 'representative_core' },
      live: { provider: 'tourapi', sourceId: 'fixture-300', availability: 'active', title: '테스트섬', lat: 35.1002, lon: 129.1002, contentTypeId: '12' },
      expected: { disposition: 'apply_live_overlay', updatedFields: ['title', 'lat', 'lon'], preservedFields: ['classification', 'aliases'] },
    },
    {
      id: 'LIVE-MAP-TITLE-UNKNOWN-01', scenario: 'existing_source_title_changes_without_reviewed_alias',
      local: { contentId: 'fixture-place-400', sourceId: 'fixture-400', title: '기존 테스트 미술관', aliases: ['기존 테스트 미술관'], lat: 35.1, lon: 129.1, contentTypeId: '14' },
      live: { provider: 'tourapi', sourceId: 'fixture-400', availability: 'active', title: '다른 테스트 시설', lat: 35.1001, lon: 129.1001, contentTypeId: '14' },
      expected: { disposition: 'review_required', autoRelink: false, liveOverlayApplied: false },
    },
    {
      id: 'LIVE-MAP-COORD-SMALL-01', scenario: 'existing_source_coordinate_changes_within_100m',
      local: { contentId: 'fixture-place-500', sourceId: 'fixture-500', title: '좌표 테스트', aliases: ['좌표 테스트'], lat: 35.1, lon: 129.1, contentTypeId: '12' },
      live: { provider: 'tourapi', sourceId: 'fixture-500', availability: 'active', title: '좌표 테스트', lat: 35.1004, lon: 129.1004, contentTypeId: '12' },
      expected: { disposition: 'apply_live_overlay', coordinateDistanceBand: 'lte_100m', appDerivedFieldsPreserved: true },
    },
    {
      id: 'LIVE-MAP-COORD-LARGE-01', scenario: 'existing_source_coordinate_changes_over_100m',
      local: { contentId: 'fixture-place-600', sourceId: 'fixture-600', title: '좌표 이동 테스트', aliases: ['좌표 이동 테스트'], lat: 35.1, lon: 129.1, contentTypeId: '12' },
      live: { provider: 'tourapi', sourceId: 'fixture-600', availability: 'active', title: '좌표 이동 테스트', lat: 35.102, lon: 129.102, contentTypeId: '12' },
      expected: { disposition: 'review_required', coordinateDistanceBand: 'gt_100m', liveOverlayApplied: false },
    },
    {
      id: 'LIVE-MAP-ID-REUSE-01', scenario: 'probable_source_id_reuse',
      local: { contentId: 'fixture-place-700', sourceId: 'fixture-700', title: '기존 박물관', aliases: ['기존 박물관'], lat: 35.1, lon: 129.1, contentTypeId: '14', siteGroupId: 'fixture-site-a' },
      live: { provider: 'tourapi', sourceId: 'fixture-700', availability: 'active', title: '신규 쇼핑몰', lat: 35.11, lon: 129.11, contentTypeId: '38' },
      expected: { disposition: 'review_required_probable_id_reuse', autoRelink: false, liveOverlayApplied: false },
    },
    {
      id: 'LIVE-MAP-BOTH-CONFLICT-01', scenario: 'tourapi_live_and_busan_stored_snapshot_conflict',
      local: { contentId: 'fixture-place-800', tourapiSourceId: 'fixture-tour-800', busanSourceId: 'fixture-busan-800', category: '문화시설', subCategory: '미술관', detailDescription: '검토된 부산 설명', classification: 'representative_core', recommendedStayMin: 60 },
      tourapiLive: { provider: 'tourapi', sourceId: 'fixture-tour-800', availability: 'active', title: '실시간 테스트 미술관', addr1: '부산 테스트구 실시간로 1', lat: 35.1, lon: 129.1, contentTypeId: '14', operatingHours: ['10:00-18:00'] },
      busanStoredSnapshot: { provider: 'busan_attraction', sourceId: 'fixture-busan-800', title: '부산 테스트 문화관', addr1: '부산 테스트구 과거로 2', operatingHours: ['09:00-17:00'], detailDescription: '검토된 부산 설명' },
      expected: { disposition: 'apply_field_level_contract', sessionTitleSource: 'tourapi_live', sessionAddressSource: 'tourapi_live', sessionHoursSource: 'tourapi_live', detailDescriptionSource: 'busan_stored_snapshot', busanFreshnessClaim: false, preservedFields: ['category', 'subCategory', 'classification', 'recommendedStayMin'] },
    },
    {
      id: 'LIVE-MAP-PHOTO-RIGHTS-01', scenario: 'accepted_place_with_changed_photo_url_without_permission_mapping',
      local: { contentId: 'fixture-place-900', sourceId: 'fixture-900', imageUrl: 'https://example.invalid/allowed-old.jpg', photoPermissionStatus: 'operator_approved' },
      live: { provider: 'tourapi', sourceId: 'fixture-900', availability: 'active', title: '사진 테스트', imageUrl: 'https://example.invalid/unmapped-new.jpg' },
      expected: { disposition: 'apply_place_without_new_photo', imageDisposition: 'default_image', rightsInferred: false },
    },
  ],
};

const allBusanSnapshots = overlapRows.flatMap((row) => row.storedSnapshots.busan);
const contract = {
  meta: {
    taskId: 'DATA-LIVE-MAPPING-CONTRACT-02',
    contractVersion: 1,
    deterministic: true,
    externalCalls: 0,
    freshnessBoundary: 'TourAPI live facts may be current in phase 1; every 부산 row in this artifact is a stored static snapshot and is never labelled latest.',
  },
  summary: {
    overlapPlaces: overlapRows.length,
    overlapBusanSourceLinks: allBusanSnapshots.length,
    sourceCombination: countBy(overlaps, (row) => row.sourceCombination.join('+')),
    storedTourapiSnapshotExactlyMatchesRuntimeCommonFields: overlapRows.filter((row) => row.existingMappingAssessment.tourapiSnapshotExactlyMatchesRuntimeCommonFields).length,
    busanTitleRelations: countBy(allBusanSnapshots, (row) => row.comparisonToRuntime.titleRelation),
    busanCoordinateDistanceBands: countBy(allBusanSnapshots, (row) => {
      const distance = row.comparisonToRuntime.coordinateDistanceM;
      if (distance <= 100) return 'lte_100m';
      if (distance <= 250) return 'gt_100m_lte_250m';
      return 'gt_250m';
    }),
    busanCoordinateDistanceMaxM: Math.max(...allBusanSnapshots.map((row) => row.comparisonToRuntime.coordinateDistanceM ?? 0)),
    busanRowsWithOperatingHoursText: allBusanSnapshots.filter((row) => row.operatingHoursText).length,
    busanRowsWithDetailDescription: allBusanSnapshots.filter((row) => row.detailDescriptionPresent).length,
  },
  phase1Policy: {
    activeProvider: 'tourapi',
    apply: 'TourAPI complete-list active/inactive membership, modified facts, and returned common fields only after exact-ID identity gate.',
    preserve: 'Busan-only reviewed fields and every app-derived category/dwell/classification/relationship field.',
    forbid: 'Calling stored Busan values latest, whole-record provider priority, live auto-reclassification, static resurrection after explicit TourAPI deletion.',
    traditionalMarketOnly: { count: 118, disposition: 'review_required_provider_out_of_scope', tourapiFreshnessClaim: false },
  },
  fieldContract,
  reviewRules,
  integrationHandoff: {
    observedCurrentAdapterContract: {
      operations: ['areaBasedList2', 'detailIntro2'],
      resultStatuses: ['ready', 'partial', 'unavailable'],
      normalizedPlaceFields: ['contentId', 'contentTypeId', 'title', 'address?', 'lat', 'lon', 'modifiedAt?', 'opening'],
      note: 'Observed from the current worktree only; this data task did not modify the adapter.',
    },
    blockingAmbiguityForMappingLayer: {
      currentShape: 'snapshot.places contains active approved IDs whose detailIntro2 succeeded; partial.failures are not content-ID scoped',
      consequence: 'an approved ID omitted from a partial snapshot cannot be distinguished as inactive from active-with-detail-failure',
      requiredResolution: 'return a complete active-approved ID set plus content-ID-scoped detail failures, or return one status per approved ID: active_ready | active_detail_failed | inactive',
    },
    engineInputAfterResolution: 'accepted session places only, retaining internal contentId/category/subCategory/dwell/classification/relationship fields and excluding confirmed inactive or identity-conflict rows',
  },
  overlaps: overlapRows,
};

const classificationCounts = countBy(places, (place) => place.classification);
const photoStatusCounts = countBy(places.filter((place) => place.imageUrl), (place) => place.imageEvidence?.usagePermission?.status ?? 'missing');
assert.equal(places.length, 369, 'runtime count changed');
assert.deepEqual(classificationCounts, { representative_core: 28, representative_standard: 163, conditional_more: 178 }, 'classification baseline changed');
assert.equal(places.filter((place) => place.subCategory).length, 236, 'subCategory baseline changed');
assert.equal(places.filter((place) => place.operatingHours?.length).length, 122, 'operatingHours baseline changed');
assert.equal(places.filter((place) => place.detailDescription).length, 127, 'detailDescription baseline changed');
assert.equal(places.filter((place) => place.imageUrl).length, 203, 'photo baseline changed');
assert.deepEqual(photoStatusCounts, { verified: 101, operator_approved: 102 }, 'photo rights baseline changed');
assert.equal(overlapRows.length, 20, 'overlap place count changed');
assert.equal(allBusanSnapshots.length, 21, 'overlap Busan link count changed');
assert.ok(overlapRows.every((row) => row.existingMappingAssessment.tourapiSnapshotExactlyMatchesRuntimeCommonFields), 'stored TourAPI/runtime mismatch');
assert.ok(overlapRows.every((row) => row.existingMappingAssessment.busanTitlesResolveByReviewedTitleOrAlias), 'Busan title outside reviewed aliases');
assert.equal(sourceMappings.filter((row) => row.joinDisposition === 'review_required_provider_out_of_scope').length, 118, 'traditional-market-only baseline changed');
assert.deepEqual(fixture.cases.map((row) => row.scenario), [
  'new_source_id',
  'existing_source_confirmed_inactive_or_deleted',
  'existing_source_title_changes_to_reviewed_alias',
  'existing_source_title_changes_without_reviewed_alias',
  'existing_source_coordinate_changes_within_100m',
  'existing_source_coordinate_changes_over_100m',
  'probable_source_id_reuse',
  'tourapi_live_and_busan_stored_snapshot_conflict',
  'accepted_place_with_changed_photo_url_without_permission_mapping',
]);

const audit = {
  meta: { taskId: 'DATA-LIVE-MAPPING-CONTRACT-02', contractVersion: 1, externalCalls: 0 },
  checks: {
    overlap20Exhaustive: true,
    storedTourapiCommonFieldsMatchRuntime20: true,
    busanLinks21Resolve: true,
    busanTitlesWithinReviewedAliases: true,
    fieldLevelContractPresent: true,
    identityReviewRulesPresentOutsideProductCode: true,
    requiredTransitionFixturesPresent: true,
    runtimeIdentityClassificationDwellPhotoBaselinesPreserved: true,
    traditionalMarket118ProviderOutOfScopePreserved: true,
  },
  baselines: {
    runtimePlaces: places.length,
    classification: classificationCounts,
    subCategory: 236,
    operatingHours: 122,
    detailDescription: 127,
    photos: 203,
    photoStatus: photoStatusCounts,
    overlapPlaces: overlapRows.length,
    overlapBusanSourceLinks: allBusanSnapshots.length,
    traditionalMarketOnly: 118,
  },
  hashes: {
    fieldContractSha256: hash(fieldContract),
    reviewRulesSha256: hash(reviewRules),
    overlapRowsSha256: hash(overlapRows),
    fixtureCasesSha256: hash(fixture.cases),
  },
};

write(CONTRACT_OUTPUT, contract);
write(FIXTURE_OUTPUT, fixture);
write(AUDIT_OUTPUT, audit);
console.log(JSON.stringify({
  overlapPlaces: overlapRows.length,
  overlapBusanSourceLinks: allBusanSnapshots.length,
  titleRelations: contract.summary.busanTitleRelations,
  coordinateDistanceBands: contract.summary.busanCoordinateDistanceBands,
  coordinateDistanceMaxM: contract.summary.busanCoordinateDistanceMaxM,
  fieldContractRows: fieldContract.length,
  fixtureCases: fixture.cases.length,
  traditionalMarketOnly: contract.phase1Policy.traditionalMarketOnly,
  externalCalls: 0,
}, null, 2));
