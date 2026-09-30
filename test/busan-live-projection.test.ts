import assert from 'node:assert/strict';
import test from 'node:test';
import type { BusanLiveRecord, BusanLiveResult, BusanLiveSourceKey, BusanLiveSourceResult } from '../src/services/busanLiveAdapter';
import type { LiveCatalogProjection, LiveCatalogProjectedCandidate } from '../src/data/liveCatalogProjection';
import {
  createMultiSourceLiveInputs,
  projectMultiSourceLiveCatalog,
  type MultiSourceLocalInput,
  type TourLiveFieldSupplement,
} from '../src/data/busanLiveProjection';
import {
  auditStoredRepresentativeBusanOpenings,
  normalizeBusanLiveOpening,
} from '../src/data/busanLiveOpeningNormalizer';
import { normalizeTourLiveOpening } from '../src/data/liveOpeningNormalizer';

const SNAPSHOT = 'busan-projection-fixture-1';
const inputs = createMultiSourceLiveInputs();
const representative = inputs.filter((row) => row.place.policy.classification === 'representative_core' || row.place.policy.classification === 'representative_standard');
const busanOnly = representative.find((row) => row.partition === 'busan_only')!;
const both = representative.find((row) => row.partition === 'tourapi_and_busan')!;

function tourCandidate(local: MultiSourceLocalInput, overrides: Partial<LiveCatalogProjectedCandidate['facts']> = {}): LiveCatalogProjectedCandidate {
  if (!local.place.mapping) throw new Error('TourAPI mapping required');
  return {
    id: local.place.id,
    order: local.place.order,
    source: { provider: 'tourapi', contentId: local.place.mapping.contentId, contentTypeId: local.place.mapping.contentTypeId },
    state: 'active_catalog',
    facts: { title: local.place.identity.title, lat: local.place.identity.lat, lon: local.place.identity.lon, ...overrides },
    provenance: { title: 'tourapi_live_catalog', lat: 'tourapi_live_catalog', lon: 'tourapi_live_catalog' },
    policy: local.place.policy,
    relations: local.place.relations,
  };
}

function tourProjection(local: MultiSourceLocalInput, state: 'active_catalog' | 'inactive' | 'source_unavailable' | 'identity_conflict', overrides: Partial<LiveCatalogProjectedCandidate['facts']> = {}): LiveCatalogProjection {
  return {
    status: state === 'source_unavailable' ? 'unavailable' : state === 'active_catalog' ? 'ready' : 'partial',
    liveSourceSnapshotId: SNAPSHOT,
    fetchedAt: '2026-09-22T00:00:00.000Z',
    candidates: state === 'active_catalog' ? [tourCandidate(local, overrides)] : [],
    records: [{
      placeId: local.place.id,
      providerScope: 'tourapi',
      sourceContentId: local.tourapiSourceId,
      sourceContentTypeId: local.place.mapping?.contentTypeId,
      state,
    }],
    unreviewedSourceCount: 0,
    summary: {
      runtimePlaces: 1,
      tourapiMapped: 1,
      activeCatalog: state === 'active_catalog' ? 1 : 0,
      inactive: state === 'inactive' ? 1 : 0,
      identityConflict: state === 'identity_conflict' ? 1 : 0,
      providerOutOfScope: 0,
      traditionalMarketOnly: 0,
    },
  };
}

function unavailableTour(): LiveCatalogProjection {
  return {
    status: 'unavailable', liveSourceSnapshotId: SNAPSHOT, fetchedAt: null, candidates: [], records: [], unreviewedSourceCount: 0,
    summary: { runtimePlaces: 369, tourapiMapped: 139, activeCatalog: 0, inactive: 0, identityConflict: 0, providerOutOfScope: 230, traditionalMarketOnly: 118 },
  };
}

function unavailableSource(): BusanLiveSourceResult {
  return { status: 'unavailable', complete: false, providerCalls: 0, reason: { code: 'network', status: null } };
}

function busanRecord(local: MultiSourceLocalInput, overrides: Partial<BusanLiveRecord> = {}): BusanLiveRecord {
  const mapping = local.busanMappings[0];
  return {
    source: mapping.source,
    sourceId: mapping.sourceId,
    title: local.place.identity.title,
    lat: local.place.identity.lat,
    lon: local.place.identity.lon,
    openingText: '09:00~18:00',
    photo: { status: 'not_returned_without_approved_evidence' },
    ...overrides,
  };
}

function busanResult(local: MultiSourceLocalInput, state: 'active' | 'inactive' | 'unavailable', overrides: Partial<BusanLiveRecord> = {}, recordsOrder: 'normal' | 'reversed' = 'normal'): BusanLiveResult {
  const mapping = local.busanMappings[0];
  const record = busanRecord(local, overrides);
  const decoy: BusanLiveRecord = { ...record, sourceId: '999999', title: '미승인 신규 장소' };
  const records = recordsOrder === 'normal' ? [record, decoy] : [decoy, record];
  const sourceResult: BusanLiveSourceResult = state === 'unavailable'
    ? unavailableSource()
    : {
      status: 'ready', complete: true, providerCalls: 1,
      activeApprovedSourceIds: state === 'active' ? [mapping.sourceId] : [],
      inactiveApprovedSourceIds: state === 'inactive' ? [mapping.sourceId] : [],
      records: state === 'active' ? records : [],
    };
  const sources: Record<BusanLiveSourceKey, BusanLiveSourceResult> = {
    busan_attraction: unavailableSource(),
    busan_food: unavailableSource(),
    busan_shopping: unavailableSource(),
  };
  sources[mapping.source] = sourceResult;
  return { status: state === 'unavailable' ? 'unavailable' : 'partial', liveSourceSnapshotId: SNAPSHOT, providerCalls: state === 'unavailable' ? 0 : 1, sources };
}

function tourSupplement(local: MultiSourceLocalInput, openingText = '09:00~18:00'): TourLiveFieldSupplement {
  if (!local.tourapiSourceId || !local.place.mapping) throw new Error('TourAPI mapping required');
  return {
    liveSourceSnapshotId: SNAPSHOT,
    placeId: local.place.id,
    sourceId: local.tourapiSourceId,
    openingText,
    openingResult: normalizeTourLiveOpening({
      placeId: local.place.id,
      sourceId: local.tourapiSourceId,
      contentTypeId: local.place.mapping.contentTypeId,
      referenceDate: '2026-09-22',
      opening: { rawText: openingText },
    }),
  };
}

function recordFor(result: ReturnType<typeof projectMultiSourceLiveCatalog>, placeId: string) {
  return result.records.find((row) => row.placeId === placeId)!;
}

function fullEquivalentFixture(): { tour: LiveCatalogProjection; busan: BusanLiveResult; tourSupplements: TourLiveFieldSupplement[] } {
  const activeTour = representative.filter((row) => row.tourapiSourceId);
  const tourRecords = inputs.flatMap((local) => local.tourapiSourceId ? [{
    placeId: local.place.id,
    providerScope: 'tourapi' as const,
    sourceContentId: local.tourapiSourceId,
    sourceContentTypeId: local.place.mapping?.contentTypeId,
    state: representative.includes(local) ? 'active_catalog' as const : 'inactive' as const,
  }] : []);
  const tour: LiveCatalogProjection = {
    status: 'ready', liveSourceSnapshotId: SNAPSHOT, fetchedAt: '2026-09-22T00:00:00.000Z',
    candidates: activeTour.map((local) => tourCandidate(local)), records: tourRecords, unreviewedSourceCount: 0,
    summary: { runtimePlaces: 369, tourapiMapped: 139, activeCatalog: activeTour.length, inactive: 139 - activeTour.length, identityConflict: 0, providerOutOfScope: 230, traditionalMarketOnly: 118 },
  };
  const sources = Object.fromEntries((['busan_attraction', 'busan_food', 'busan_shopping'] as const).map((source) => {
    const mappings = inputs.flatMap((local) => local.busanMappings.filter((mapping) => mapping.source === source).map((mapping) => ({ local, mapping })));
    const active = mappings.filter(({ local }) => representative.includes(local));
    const inactive = mappings.filter(({ local }) => !representative.includes(local));
    const result: BusanLiveSourceResult = {
      status: 'ready', complete: true, providerCalls: 1,
      activeApprovedSourceIds: active.map(({ mapping }) => mapping.sourceId),
      inactiveApprovedSourceIds: inactive.map(({ mapping }) => mapping.sourceId),
      records: active.map(({ local, mapping }) => ({
        source, sourceId: mapping.sourceId, title: local.place.identity.title,
        lat: local.place.identity.lat, lon: local.place.identity.lon,
        openingText: '09:00~18:00', photo: { status: 'not_returned_without_approved_evidence' as const },
      })),
    };
    return [source, result];
  })) as Record<BusanLiveSourceKey, BusanLiveSourceResult>;
  const busan: BusanLiveResult = { status: 'ready', liveSourceSnapshotId: SNAPSHOT, providerCalls: 3, sources };
  return { tour, busan, tourSupplements: activeTour.map((local) => tourSupplement(local)) };
}

test('DATA-BUSAN-LIVE-PROJECTION-02: 369/191과 TourAPI-only82, Busan-only93, both16 mapping을 보존한다', () => {
  assert.equal(inputs.length, 369);
  assert.equal(representative.length, 191);
  assert.equal(representative.filter((row) => row.partition === 'tourapi_only').length, 82);
  assert.equal(representative.filter((row) => row.partition === 'busan_only').length, 93);
  assert.equal(representative.filter((row) => row.partition === 'tourapi_and_busan').length, 16);
  assert.equal(inputs.filter((row) => row.partition === 'traditional_market_only').length, 118);
});

test('DATA-BUSAN-LIVE-PROJECTION-02-R1: 동등한 전체 live fixture에서 대표 191개를 모두 보존한다', () => {
  const result = projectMultiSourceLiveCatalog(fullEquivalentFixture());
  assert.equal(result.summary.representativePlaces, 191);
  assert.deepEqual(result.summary.representativePartitions, { tourapiOnly: 82, busanOnly: 93, tourapiAndBusan: 16 });
  assert.equal(result.summary.activeRepresentative, 191);
  assert.equal(result.candidates.length, 191);
});

test('DATA-BUSAN-LIVE-PROJECTION-02: 부산 active/inactive/unavailable을 완결 상태 그대로 투영한다', () => {
  const active = projectMultiSourceLiveCatalog({ tour: unavailableTour(), busan: busanResult(busanOnly, 'active') });
  assert.equal(recordFor(active, busanOnly.place.id).state, 'active');
  assert.equal(active.candidates.some((row) => row.id === busanOnly.place.id), true);
  const inactive = projectMultiSourceLiveCatalog({ tour: unavailableTour(), busan: busanResult(busanOnly, 'inactive') });
  assert.equal(recordFor(inactive, busanOnly.place.id).state, 'inactive');
  const unavailable = projectMultiSourceLiveCatalog({ tour: unavailableTour(), busan: busanResult(busanOnly, 'unavailable') });
  assert.equal(recordFor(unavailable, busanOnly.place.id).state, 'source_unavailable');
});

test('DATA-BUSAN-LIVE-PROJECTION-02: 한 provider active면 다른 provider inactive/unavailable이어도 유지하고 모두 inactive만 global inactive다', () => {
  const supplement = tourSupplement(both);
  const activeInactive = projectMultiSourceLiveCatalog({ tour: tourProjection(both, 'inactive'), busan: busanResult(both, 'active') });
  assert.equal(recordFor(activeInactive, both.place.id).state, 'active');
  const activeUnavailable = projectMultiSourceLiveCatalog({ tour: tourProjection(both, 'source_unavailable'), busan: busanResult(both, 'active') });
  assert.equal(recordFor(activeUnavailable, both.place.id).state, 'active');
  const inactiveActive = projectMultiSourceLiveCatalog({ tour: tourProjection(both, 'active_catalog'), busan: busanResult(both, 'inactive'), tourSupplements: [supplement] });
  assert.equal(recordFor(inactiveActive, both.place.id).state, 'active');
  const allInactive = projectMultiSourceLiveCatalog({ tour: tourProjection(both, 'inactive'), busan: busanResult(both, 'inactive') });
  assert.equal(recordFor(allInactive, both.place.id).state, 'inactive');
  const allUnavailable = projectMultiSourceLiveCatalog({ tour: tourProjection(both, 'source_unavailable'), busan: busanResult(both, 'unavailable') });
  assert.equal(recordFor(allUnavailable, both.place.id).state, 'source_unavailable');
});

test('DATA-BUSAN-LIVE-PROJECTION-02-R1: both active는 TourAPI 공통 사실·운영시간과 부산 설명을 필드별 소유한다', () => {
  const tour = tourProjection(both, 'active_catalog', { address: '부산 Tour 주소 1' });
  const supplement = tourSupplement(both, '09:00~18:00');
  const result = projectMultiSourceLiveCatalog({
    tour,
    busan: busanResult(both, 'active', {
      title: `${both.place.identity.title} 부산 표기`,
      address: '부산 Busan 주소 2',
      lat: both.place.identity.lat + 0.001,
      lon: both.place.identity.lon + 0.001,
      openingText: '점포별 상이',
      description: '부산 live 설명',
    }),
    tourSupplements: [{ ...supplement, description: 'TourAPI 설명' }],
  });
  assert.equal(recordFor(result, both.place.id).state, 'active');
  const candidate = result.candidates.find((row) => row.id === both.place.id)!;
  assert.equal(candidate.facts.title, both.place.identity.title);
  assert.equal(candidate.facts.address, '부산 Tour 주소 1');
  assert.equal(candidate.facts.lat, both.place.identity.lat);
  assert.equal(candidate.facts.lon, both.place.identity.lon);
  assert.equal(candidate.facts.description, '부산 live 설명');
  assert.deepEqual(candidate.provenance.opening, ['tourapi']);
  assert.equal(Object.isFrozen(result), true);
});

test('DATA-BUSAN-LIVE-PROJECTION-02-R1: 현재 관찰 범위 좌표 차이·제목 표기만으로 배제하지 않고 한쪽 optional 값을 사용한다', () => {
  const tourWithoutAddress = tourProjection(both, 'active_catalog');
  const result = projectMultiSourceLiveCatalog({
    tour: tourWithoutAddress,
    busan: busanResult(both, 'active', {
      title: `${both.place.identity.title}(부산)`,
      address: '부산 한쪽 주소',
      lat: both.place.identity.lat + 0.0015,
      description: '부산 설명',
    }),
    tourSupplements: [tourSupplement(both)],
  });
  assert.equal(recordFor(result, both.place.id).state, 'active');
  assert.equal(result.candidates.find((row) => row.id === both.place.id)?.facts.address, '부산 한쪽 주소');
});

test('DATA-BUSAN-LIVE-PROJECTION-02-R1: compound identity와 TourAPI identity_conflict는 부산 active로 우회하지 않는다', () => {
  const compound = projectMultiSourceLiveCatalog({
    tour: tourProjection(both, 'active_catalog'),
    busan: busanResult(both, 'active', { title: '전혀 다른 장소', lat: both.place.identity.lat + 0.02, lon: both.place.identity.lon + 0.02 }),
    tourSupplements: [tourSupplement(both)],
  });
  assert.equal(recordFor(compound, both.place.id).reason, 'identity_conflict');
  const tourConflict = projectMultiSourceLiveCatalog({ tour: tourProjection(both, 'identity_conflict'), busan: busanResult(both, 'active') });
  assert.equal(recordFor(tourConflict, both.place.id).reason, 'identity_conflict');
});

test('DATA-BUSAN-LIVE-PROJECTION-02: 부산 운영시간 exact reuse·안전 parse와 휴무·모호 문법 fail-closed를 구분한다', () => {
  const exact = normalizeBusanLiveOpening({ placeId: 'poi_1047', source: 'busan_food', sourceId: '174', openingText: '10:00-24:00' });
  assert.equal(exact.status, 'structured');
  assert.equal(exact.provenance.mode, 'reviewed_exact_reuse');
  const safe = normalizeBusanLiveOpening({ placeId: 'poi_1047', source: 'busan_food', sourceId: '174', openingText: '09:00~18:00' });
  assert.equal(safe.status, 'structured');
  assert.equal(safe.provenance.mode, 'live_runtime_parse');
  assert.equal(safe.availability.alwaysAccessible, false);
  assert.equal(normalizeBusanLiveOpening({ placeId: 'poi_1047', source: 'busan_food', sourceId: '174', openingText: '09:00~18:00', closedText: '매주 월요일' }).status, 'needs_review');
  assert.equal(normalizeBusanLiveOpening({ placeId: 'poi_1047', source: 'busan_food', sourceId: '174', openingText: '점포별 상이' }).status, 'needs_review');
  assert.equal(normalizeBusanLiveOpening({ placeId: 'poi_1047', source: 'busan_food', sourceId: '999', openingText: '09:00~18:00' }).status, 'needs_review');
});

test('DATA-BUSAN-LIVE-PROJECTION-02: 저장 대표 부산 109곳/110링크 opening audit 분포를 고정한다', () => {
  assert.deepEqual(auditStoredRepresentativeBusanOpenings().summary, {
    representativePlaces: 109,
    representativeLinks: 110,
    exactReviewedReuse: 36,
    safeRuntimeParse: 21,
    needsReview: 53,
  });
});

test('DATA-BUSAN-LIVE-PROJECTION-02: 신규 ID·전통시장-only를 승격하지 않고 변경 사진은 기본 이미지로 닫는다', () => {
  const result = projectMultiSourceLiveCatalog({ tour: unavailableTour(), busan: busanResult(busanOnly, 'active') });
  assert.equal(result.candidates.some((row) => row.facts.title === '미승인 신규 장소'), false);
  assert.equal(result.candidates.find((row) => row.id === busanOnly.place.id)?.photoDisposition, 'default_no_approved_evidence');
  assert.equal(result.summary.traditionalMarketOnly, 118);
  assert.equal(result.records.filter((row) => row.partition === 'traditional_market_only').every((row) => row.state === 'provider_out_of_scope'), true);

  const approvedPhoto = {
    status: 'approved' as const,
    url: 'https://www.visitbusan.net/approved.jpg',
    attribution: '사진 제공: 부산광역시',
    sourcePageUrl: 'https://www.data.go.kr/example',
    licenseName: '이용허락범위 제한 없음' as const,
    commercialUseAllowed: true as const,
    modificationAllowed: true as const,
    verifiedAt: '2026-09-07',
  };
  const approved = projectMultiSourceLiveCatalog({ tour: unavailableTour(), busan: busanResult(busanOnly, 'active', { photo: approvedPhoto }) });
  const candidate = approved.candidates.find((row) => row.id === busanOnly.place.id)!;
  assert.equal(candidate.photoDisposition, 'approved_exact');
  assert.equal(candidate.facts.photo?.url, approvedPhoto.url);
  assert.deepEqual(candidate.provenance.photo, [busanOnly.busanMappings[0].source]);
});

test('DATA-BUSAN-LIVE-PROJECTION-02: provider record와 supplement 입력 순서는 결과를 바꾸지 않는다', () => {
  const forward = projectMultiSourceLiveCatalog({ tour: unavailableTour(), busan: busanResult(busanOnly, 'active', {}, 'normal'), tourSupplements: [] });
  const reversed = projectMultiSourceLiveCatalog({ tour: unavailableTour(), busan: busanResult(busanOnly, 'active', {}, 'reversed'), tourSupplements: [] });
  assert.deepEqual(forward, reversed);
});

test('DATA-BUSAN-LIVE-PROJECTION-02: 서로 다른 session snapshot과 raw 운영시간 출력은 fail-closed한다', () => {
  const mismatchedBusan = busanResult(busanOnly, 'active');
  if (!('sources' in mismatchedBusan)) throw new Error('fixture requires source result');
  const result = projectMultiSourceLiveCatalog({
    tour: { ...unavailableTour(), liveSourceSnapshotId: 'different-snapshot' },
    busan: mismatchedBusan,
  });
  assert.equal(recordFor(result, busanOnly.place.id).reason, 'snapshot_mismatch');
  assert.equal(result.candidates.length, 0);
  assert.equal(JSON.stringify(result).includes('09:00~18:00'), false);
});
