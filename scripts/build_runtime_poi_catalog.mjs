#!/usr/bin/env node
// 검토를 마친 자투리 활동 카탈로그를 앱 번들용 데이터로 변환한다.
// 원본 검토 카탈로그는 data/processed/review에 보존하고, 앱은 이 출력만 읽는다.
import fs from 'node:fs';
import { buildOfficialDetailDescriptionPlan } from './build_place_detail_description.mjs';

const SHORT_STAY_CATALOG = 'data/processed/review/부산_장소_근거프로필_재분류.json';
const LEGACY = 'src/data/busan_poi_catalog.legacy.json';
const OUTPUT = 'src/data/busan_poi_catalog.json';
const TOURAPI_IMAGE_AUDIT = 'data/processed/review/현재사용_TourAPI_대표이미지_감사.json';
const TOURAPI_IMAGE_HTTPS_VALIDATION = 'data/processed/review/현재사용_TourAPI_대표이미지_HTTPS검증.json';
const TOURAPI_REPRESENTATIVE_IMAGE_HTTPS_VALIDATION = 'data/processed/review/현재사용_대표후보_TourAPI_HTTPS검증결과.json';
const AREA_DISCOVERY_AUDIT = 'data/processed/review/권역형_발견후보_감사.json';
const CONDITIONAL_MARKET_AUDIT = 'data/processed/review/조건부_시장거리_발견후보_감사.json';
const OFFICIAL_SOURCES = {
  busan_attraction: 'data/processed/부산시_명소정보.json',
  busan_shopping: 'data/processed/부산시_쇼핑정보.json',
  busan_food: 'data/processed/부산시_맛집정보.json',
};

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const countBy = (rows, selector) => rows.reduce((result, row) => {
  const key = selector(row) ?? 'unknown';
  result[key] = (result[key] ?? 0) + 1;
  return result;
}, {});

const legacy = read(LEGACY);
const existing = fs.existsSync(OUTPUT) ? read(OUTPUT) : null;
const legacyPlaces = [...legacy.matched.data, ...legacy.unmatched.data];
const legacyByContentId = new Map(legacyPlaces.map((place) => [String(place.contentId), place]));
const existingPlaces = existing ? [...existing.matched.data, ...existing.unmatched.data] : [];
const existingByContentId = new Map(existingPlaces.map((place) => [String(place.contentId), place]));
const areaDiscoveryByContentId = fs.existsSync(AREA_DISCOVERY_AUDIT)
  ? new Map(read(AREA_DISCOVERY_AUDIT).data.map((item) => [item.contentId, item])) : new Map();
const conditionalMarketByContentId = fs.existsSync(CONDITIONAL_MARKET_AUDIT)
  ? new Map(read(CONDITIONAL_MARKET_AUDIT).data.map((item) => [item.contentId, item])) : new Map();
const categoryDwell = legacy.categoryDwell;
const tourapiImageAuditByContentId = fs.existsSync(TOURAPI_IMAGE_AUDIT)
  ? new Map(read(TOURAPI_IMAGE_AUDIT).samples.map((item) => [item.contentId, item])) : new Map();
const legacyTourapiImageValidation = fs.existsSync(TOURAPI_IMAGE_HTTPS_VALIDATION) ? read(TOURAPI_IMAGE_HTTPS_VALIDATION) : null;
const representativeTourapiImageValidation = fs.existsSync(TOURAPI_REPRESENTATIVE_IMAGE_HTTPS_VALIDATION) ? read(TOURAPI_REPRESENTATIVE_IMAGE_HTTPS_VALIDATION) : null;
const acceptedTourapiImageByContentId = new Map([
  ...(legacyTourapiImageValidation?.data ?? []),
  ...(representativeTourapiImageValidation?.data ?? []),
].filter((item) => item.accepted).map((item) => [item.contentId, item]));
const officialBySource = Object.fromEntries(Object.entries(OFFICIAL_SOURCES).map(([source, file]) => {
  const payload = read(file);
  const rows = Array.isArray(payload) ? payload : payload.data ?? payload.items ?? [];
  return [source, new Map(rows.map((row) => [String(row.UC_SEQ), row]))];
}));
let officialDetailDescriptions = new Map();

const contentTypeForCategory = {
  자연관광지: '12',
  문화시설: '14',
  '레저/스포츠': '28',
  상업지구: '38',
  카페: '39',
};

function sourceTourApiId(place) {
  return place.sourceEvidence?.find((source) => source.source === 'tourapi_aihub' || source.source === 'tourapi_fallback')?.sourceId;
}

function kakaoSearchUrl(title) {
  return `https://map.kakao.com/link/search/${encodeURIComponent(title)}`;
}

function officialImage(place) {
  for (const evidence of place.sourceEvidence ?? []) {
    const source = officialBySource[evidence.source];
    const row = source?.get(String(evidence.sourceId));
    const url = row?.MAIN_IMG_THUMB ?? row?.MAIN_IMG_NORMAL;
    if (typeof url === 'string' && url.startsWith('https://')) {
      return { imageUrl: url, imageSource: 'busan_official' };
    }
  }
  return null;
}

function tourapiImage(place, tourapiContentId) {
  if (!tourapiContentId) return null;
  const audit = tourapiImageAuditByContentId.get(place.id);
  const validation = acceptedTourapiImageByContentId.get(place.id);
  if (!audit || !validation || String(audit.tourapiContentId) !== String(tourapiContentId) || String(validation.tourapiContentId) !== String(tourapiContentId)) return null;
  const originalUrl = validation.originalUrl ?? validation.image;
  if (audit.image !== originalUrl || !validation.finalUrl?.startsWith('https://')) return null;
  const validationMeta = representativeTourapiImageValidation?.data.some((item) => item.contentId === place.id)
    ? representativeTourapiImageValidation.meta : legacyTourapiImageValidation?.meta;
  return { imageUrl: validation.finalUrl, imageSource: 'tourapi', imageEvidence: { source: 'tourapi', sourceId: String(tourapiContentId), auditedAt: read(TOURAPI_IMAGE_AUDIT).meta.generatedAt, httpsValidatedAt: validationMeta?.generatedAt, validationMethod: validation.method ?? validationMeta?.request, finalUrl: validation.finalUrl } };
}

function availabilityProfileFor(place) {
  if (place.shortStayType === 'scenic_pause') return 'outdoor';
  const areaKind = /시장|거리|골목|마을/.test(place.scope?.kind ?? '');
  if (place.shortStayType === 'quick_browse' && place.scope?.type === '포괄장소') return 'area';
  if (place.scope?.type === '포괄장소' && areaKind) return 'area';
  return 'facility';
}

function matchScopeFor(place) {
  if (place.selectionEvidence?.exactAihubMatch) {
    return place.scope?.type === '포괄장소' ? 'area_context' : 'direct_place';
  }
  return 'category_fallback';
}

function openingReliabilityFor(place, availabilityProfile) {
  if (place.operatingHours?.length) return 'direct';
  if (availabilityProfile === 'area') return 'area_uncertain';
  return 'unknown';
}

function mapVerificationFor(place, existingPlace, legacyPlace) {
  // 과거 카탈로그의 verified/weak 결과만 재사용한다. 과거 not_found는 당시의
  // 넓은 후보 정제 결과이므로 새 활동 카탈로그의 자동 제외 근거로 삼지 않는다.
  const previous = [existingPlace?.mapVerification, legacyPlace?.mapVerification]
    .find((value) => value && ['verified', 'weak'].includes(value.status));
  if (previous) {
    return {
      ...previous,
      placeUrl: previous.placeUrl || place.mapSearchUrl || kakaoSearchUrl(place.title),
    };
  }
  return {
    provider: 'kakao',
    status: 'unverified',
    placeUrl: place.mapSearchUrl || kakaoSearchUrl(place.title),
  };
}

function discoveryFor(place) {
  const reviewed = areaDiscoveryByContentId.get(place.id);
  // 새 감사 결과가 없는 항목은 자동 탐색으로 조용히 들어가지 않는다.
  if (!reviewed) return { eligibility: 'conditional', exclusionReason: 'discovery_audit_missing' };
  if (reviewed.discoveryEligibility === 'area_access') {
    return {
      eligibility: 'area_access',
      accessEvidence: reviewed.accessEvidence,
      accessWindow: reviewed.accessWindow,
    };
  }
  return {
    eligibility: reviewed.discoveryEligibility,
    ...(reviewed.exclusionReason ? { exclusionReason: reviewed.exclusionReason } : {}),
  };
}

function conditionalVisitFor(place) {
  const reviewed = conditionalMarketByContentId.get(place.id);
  if (place.classification !== 'conditional_more' || reviewed?.decision !== 'conditional_visit') return null;
  const value = reviewed.conditionalVisit;
  if (value?.kind !== 'market_or_street'
    || value.displayWindow?.start !== '10:00'
    || value.displayWindow?.end !== '18:00'
    || value.requiresUserHoursConfirmation !== true) return null;
  return value;
}

function toRuntime(place) {
  const tourapiContentId = sourceTourApiId(place);
  const legacyPlace = tourapiContentId ? legacyByContentId.get(String(tourapiContentId)) : null;
  const existingPlace = existingByContentId.get(String(place.id));
  const availabilityProfile = availabilityProfileFor(place);
  const matchScope = matchScopeFor(place);
  const image = officialImage(place) ?? tourapiImage(place, tourapiContentId) ?? (existingPlace?.imageUrl ? {
    imageUrl: existingPlace.imageUrl,
    imageSource: existingPlace.imageSource,
  } : null);

  return {
    contentId: place.id,
    title: place.title,
    contentTypeId: legacyPlace?.contentTypeId ?? contentTypeForCategory[place.category] ?? 'local',
    contentTypeName: legacyPlace?.contentTypeName ?? '부산 자투리 활동 데이터',
    category: place.category,
    subCategory: place.scope?.kind ?? legacyPlace?.subCategory,
    availabilityProfile,
    addr1: place.address ?? '',
    lat: place.lat,
    lon: place.lon,
    aliases: place.aliases ?? [],
    mergedPlaceIds: place.mergedPlaceIds ?? [],
    siteGroupId: place.siteGroupId,
    siteRole: place.siteRole,
    sourceEvidence: place.sourceEvidence ?? [],
    ...(officialDetailDescriptions.get(place.id)?.detailDescription ? {
      detailDescription: officialDetailDescriptions.get(place.id).detailDescription,
    } : {}),
    tourapiContentId: tourapiContentId ? String(tourapiContentId) : undefined,
    tourapiContentTypeId: tourapiContentId ? legacyPlace?.contentTypeId : undefined,
    matchScope,
    dwellSourceName: place.dwellBasis,
    openingHoursSourceName: place.title,
    openingHoursReliability: openingReliabilityFor(place, availabilityProfile),
    operatingHours: place.operatingHours ?? [],
    mapVerification: mapVerificationFor(place, existingPlace, legacyPlace),
    shortStay: {
      type: place.shortStayType,
      minStayMin: place.minStayMin,
      recommendedStayMin: place.recommendedStayMin,
      maxStayMin: place.maxStayMin,
      // 기존 엔진 호환 필드. 새 정책의 실제 분류는 아래 classification과 evidenceProfile이다.
      selectionStatus: place.classification === 'conditional_more' ? 'conditional' : 'approved',
      dwellBasis: place.dwellBasis,
      dwellReference: place.dwellReference,
      availabilityNotice: place.availabilityNotice,
    },
    classification: place.classification,
    classificationReason: place.classificationReason,
    discovery: discoveryFor(place),
    ...(conditionalVisitFor(place) ? { conditionalVisit: conditionalVisitFor(place) } : {}),
    evidenceProfile: {
      identity: place.identity,
      placeKind: place.placeKind,
      activityEvidence: place.activityEvidence,
      stayEvidence: place.stayEvidence,
      availability: place.availability,
      accessFriction: place.accessFriction,
      evidence: place.evidence,
      verifiedAt: place.verifiedAt,
      reviewDueAt: place.reviewDueAt,
    },
    ...(place.selectionEvidence?.exactAihubMatch ? {
      aihubName: place.aihubMatch?.name,
      aihubCategory: place.aihubMatch?.category,
      matchType: place.aihubMatch?.matchType,
      matchDistanceM: place.aihubMatch?.distanceM,
      dwell: place.aihubMatch?.dwell,
    } : {}),
    ...(image ?? {}),
  };
}

const source = read(SHORT_STAY_CATALOG);
const rows = source.data.filter((place) => ['representative_core', 'representative_standard', 'conditional_more'].includes(place.classification));
const officialDetailPlan = buildOfficialDetailDescriptionPlan(rows, officialBySource);
officialDetailDescriptions = officialDetailPlan.descriptions;
const matched = rows
  .filter((place) => place.selectionEvidence?.exactAihubMatch)
  .map(toRuntime);
const unmatched = rows
  .filter((place) => !place.selectionEvidence?.exactAihubMatch)
  .map(toRuntime);
const all = [...matched, ...unmatched];
const categories = [...new Set(all.map((place) => place.category))].sort();

const catalog = {
  meta: {
    generatedAt: new Date().toISOString(),
    targetRegion: '부산',
    source: '부산 자투리장소 검토 카탈로그 (TourAPI·부산 공공데이터·AI-Hub 기반)',
    sourceCatalog: SHORT_STAY_CATALOG,
    note: '앱 런타임용 자투리 활동 장소 카탈로그. 대표(core/standard)와 조건부 더보기 후보만 포함하며, 장소별 최소·권장·최대 체류 범위를 사용한다.',
    compatibility: 'shortStay.selectionStatus와 summary.selectionStatus의 approved/conditional은 전환 전 엔진 호환 필드다. 현행 후보 분류·노출 기준은 classification과 summary.classification만 사용한다.',
    legacyCatalog: 'src/data/busan_poi_catalog.legacy.json',
    candidateCollection: '로컬 카탈로그 좌표 범위 탐색. 운영시간 미확인 시설은 운영시간 게이트에서 자동 추천하지 않고 카카오맵 확인 링크를 제공한다.',
  },
  summary: {
    matched: matched.length,
    unmatched: unmatched.length,
    total: all.length,
    selectionStatus: countBy(all, (place) => place.shortStay.selectionStatus),
    classification: countBy(all, (place) => place.classification),
    shortStayType: countBy(all, (place) => place.shortStay.type),
    categories: countBy(all, (place) => place.category),
    openingHoursReliability: countBy(all, (place) => place.openingHoursReliability),
  },
  matched: {
    summary: { matched: matched.length, matchScope: countBy(matched, (place) => place.matchScope) },
    data: matched,
    byContentId: Object.fromEntries(matched.map((place) => [place.contentId, place])),
  },
  unmatched: {
    summary: { unmatched: unmatched.length, matchScope: countBy(unmatched, (place) => place.matchScope) },
    data: unmatched,
    byContentId: Object.fromEntries(unmatched.map((place) => [place.contentId, place])),
  },
  // 기존 진단 스크립트와 과거 데이터 호환용 통계다. 현재 런타임 후보는 shortStay를 우선 사용한다.
  categoryDwell: Object.fromEntries(categories.map((category) => [category, categoryDwell[category]]).filter(([, value]) => value)),
};

write(OUTPUT, catalog);
console.log(`자투리 런타임 카탈로그 생성: 매칭 ${matched.length} / 미매칭 ${unmatched.length} / 합계 ${all.length} / 공식 설명 ${officialDetailDescriptions.size}`);
