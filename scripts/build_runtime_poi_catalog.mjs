#!/usr/bin/env node
// 정제된 부산 후보를 앱 번들용 카탈로그로 변환한다.
// 기존 카탈로그는 src/data/busan_poi_catalog.legacy.json에 보관한 뒤 이 스크립트를 실행한다.
import fs from 'node:fs';

const FINAL_MATCHED = 'data/processed/부산_최종매칭장소.json';
const FINAL_UNMATCHED = 'data/processed/부산_최종미매칭장소.json';
const LEGACY = 'src/data/busan_poi_catalog.legacy.json';
const OUTPUT = 'src/data/busan_poi_catalog.json';
const OFFICIAL_SOURCES = {
  busan_attraction: 'data/processed/부산시_명소정보.json',
  busan_shopping: 'data/processed/부산시_쇼핑정보.json',
  busan_food: 'data/processed/부산시_맛집정보.json',
};

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

const legacy = read(LEGACY);
const existing = fs.existsSync(OUTPUT) ? read(OUTPUT) : null;
const legacyPlaces = [...legacy.matched.data, ...legacy.unmatched.data];
const legacyByContentId = new Map(legacyPlaces.map((place) => [String(place.contentId), place]));
const existingPlaces = existing ? [...existing.matched.data, ...existing.unmatched.data] : [];
const existingByContentId = new Map(existingPlaces.map((place) => [String(place.contentId), place]));
const categoryDwell = legacy.categoryDwell;
const officialBySource = Object.fromEntries(Object.entries(OFFICIAL_SOURCES).map(([source, file]) => {
  const payload = read(file);
  const rows = Array.isArray(payload) ? payload : payload.data ?? payload.items ?? [];
  return [source, new Map(rows.map((row) => [String(row.UC_SEQ), row]))];
}));

const contentTypeForCategory = {
  자연관광지: '12',
  문화시설: '14',
  '레저/스포츠': '28',
  상업지구: '38',
  식당: '39',
  카페: '39',
};

function sourceTourApiId(place) {
  return place.sourceEvidence?.find((source) => source.source === 'tourapi_aihub' || source.source === 'tourapi_fallback')?.sourceId;
}

function openingReliability(place, matchScope, legacyPlace) {
  if (legacyPlace?.openingHoursReliability) return legacyPlace.openingHoursReliability;
  if (place.category === '자연관광지') return 'unknown';
  if (matchScope === 'area_context') return 'area_uncertain';
  return place.operatingHours?.length ? 'direct' : 'unknown';
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

function toRuntime(place, group) {
  const tourapiContentId = sourceTourApiId(place);
  const legacyPlace = tourapiContentId ? legacyByContentId.get(String(tourapiContentId)) : null;
  const existingPlace = existingByContentId.get(String(place.id));
  const matchScope = group === 'matched'
    ? place.dwellPolicy === 'area_dwell_from_aihub' ? 'area_context' : 'direct_place'
    : 'category_fallback';
  const existingVerification = existingPlace?.mapVerification?.status !== 'unverified'
    ? existingPlace?.mapVerification
    : null;
  const mapVerification = existingVerification ?? legacyPlace?.mapVerification ?? {
    provider: 'kakao',
    status: 'unverified',
    placeUrl: kakaoSearchUrl(place.title),
  };
  const image = officialImage(place) ?? (existingPlace?.imageUrl ? {
    imageUrl: existingPlace.imageUrl,
    imageSource: existingPlace.imageSource,
  } : null);

  return {
    contentId: place.id,
    title: place.title,
    contentTypeId: legacyPlace?.contentTypeId ?? contentTypeForCategory[place.category] ?? 'local',
    contentTypeName: legacyPlace?.contentTypeName ?? '부산 공식 관광 데이터',
    category: place.category,
    subCategory: place.scope?.kind ?? legacyPlace?.subCategory,
    availabilityProfile: place.availabilityProfile,
    addr1: place.address ?? '',
    lat: place.lat,
    lon: place.lon,
    aliases: place.aliases ?? [],
    mergedPlaceIds: place.mergedPlaceIds ?? [],
    siteGroupId: place.siteGroupId,
    siteRole: place.siteRole,
    sourceEvidence: place.sourceEvidence ?? [],
    tourapiContentId: tourapiContentId ? String(tourapiContentId) : undefined,
    tourapiContentTypeId: tourapiContentId ? legacyPlace?.contentTypeId : undefined,
    matchScope,
    dwellSourceName: group === 'matched' ? place.aihubMatch?.name ?? place.title : `카테고리:${place.category}`,
    openingHoursSourceName: place.title,
    openingHoursReliability: openingReliability(place, matchScope, legacyPlace),
    operatingHours: place.operatingHours ?? [],
    holidays: place.holidays ?? [],
    mapVerification,
    ...(image ?? {}),
    ...(group === 'matched' ? {
      aihubName: place.aihubMatch?.name,
      aihubCategory: place.aihubMatch?.category,
      matchType: place.aihubMatch?.matchType,
      matchDistanceM: place.aihubMatch?.distanceM,
      dwell: place.dwell,
    } : {}),
  };
}

const matchedSource = read(FINAL_MATCHED).data;
const unmatchedSource = read(FINAL_UNMATCHED).data;
const matched = matchedSource.map((place) => toRuntime(place, 'matched'));
const unmatched = unmatchedSource.map((place) => toRuntime(place, 'unmatched'));
const categories = [...new Set([...matched, ...unmatched].map((place) => place.category))].sort();
const countBy = (rows, selector) => rows.reduce((result, row) => {
  const key = selector(row) ?? 'unknown';
  result[key] = (result[key] ?? 0) + 1;
  return result;
}, {});
const catalog = {
  meta: {
    generatedAt: new Date().toISOString(),
    targetRegion: '부산',
    source: 'TourAPI KorService2 + 부산광역시 명소·쇼핑·맛집 OpenAPI + AI-Hub 국내여행로그',
    note: '앱 런타임용 부산 POI 카탈로그. 정제 완료 장소만 포함하며, 보류·제외 목록은 추천하지 않는다.',
    legacyCatalog: 'src/data/busan_poi_catalog.legacy.json',
    candidateCollection: '로컬 카탈로그 좌표 반경 탐색. TourAPI 원본 contentId가 있는 장소만 detailIntro2 운영시간 확인을 추가로 수행한다.',
  },
  summary: {
    matched: matched.length,
    unmatched: unmatched.length,
    total: matched.length + unmatched.length,
    categories: countBy([...matched, ...unmatched], (place) => place.category),
    matchedMatchScope: countBy(matched, (place) => place.matchScope),
    unmatchedOpeningHoursReliability: countBy(unmatched, (place) => place.openingHoursReliability),
  },
  matched: {
    summary: { matched: matched.length, matchScope: countBy(matched, (place) => place.matchScope) },
    data: matched,
    byContentId: Object.fromEntries(matched.map((place) => [place.contentId, place])),
  },
  unmatched: {
    summary: { unmatched: unmatched.length, matchScope: { category_fallback: unmatched.length } },
    data: unmatched,
    byContentId: Object.fromEntries(unmatched.map((place) => [place.contentId, place])),
  },
  categoryDwell: Object.fromEntries(categories.map((category) => [category, categoryDwell[category]])),
};

write(OUTPUT, catalog);
console.log(`런타임 카탈로그 생성: 매칭 ${matched.length} / 미매칭 ${unmatched.length} / 합계 ${matched.length + unmatched.length}`);
