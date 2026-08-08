#!/usr/bin/env node
// TourAPI 관광 거점과 연결된 서면·전포 카카오 장소 후보를 검토용 JSON으로 만든다.
import fs from 'node:fs';
import path from 'node:path';

const KAKAO_REST_KEY =
  process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY
  ?? process.env.KAKAO_REST_API_KEY;

if (!KAKAO_REST_KEY) {
  throw new Error('EXPO_PUBLIC_KAKAO_REST_API_KEY 또는 KAKAO_REST_API_KEY가 필요합니다.');
}

const CATALOG_FILE = path.resolve('src/data/busan_poi_catalog.json');
const OUTPUT_FILE = path.resolve('data/processed/review/서면전포_카카오_관광맥락후보.json');
const SEARCH_RADIUS_M = 900;
const CATEGORY_SEARCHES = [
  { code: 'CE7', category: '카페', dwellProfile: '일반 카페', queryLabel: '카페' },
  { code: 'FD6', category: '식당', dwellProfile: '일반 식사', queryLabel: '음식점' },
  { code: 'CT1', category: '문화시설', dwellProfile: '문화 관람', queryLabel: '문화시설' },
];

// 추천 대상에서는 제외될 수 있어도, TourAPI에 등록된 관광 맥락 거점으로는 사용한다.
const TOURISM_ANCHORS = [
  {
    contentId: '2994179',
    title: '전포공구길',
    lat: 35.1587281711,
    lon: 129.0642801508,
    context: 'TourAPI 전포공구길 관광 동선 도보권',
  },
  {
    contentId: '132188',
    title: '부전마켓타운',
    lat: 35.1624610334,
    lon: 129.0614025211,
    context: 'TourAPI 부전마켓타운 관광 상권 도보권',
  },
  {
    contentId: '3080300',
    title: '부산전자종합시장',
    lat: 35.1637636841,
    lon: 129.0624412844,
    context: 'TourAPI 부산전자종합시장 관광 상권 도보권',
  },
  {
    contentId: '2763856',
    title: '놀이마루',
    lat: 35.1564089608,
    lon: 129.0628997796,
    context: 'TourAPI 놀이마루 문화시설 도보권',
  },
];

const EXCLUDED_NAME = /호텔|모텔|리조트|숙소|숙박|게스트하우스|펜션|주차|병원|의원|약국|학교|학원|은행|부동산|세탁|장례|교회|성당|사찰|주민센터|공인중개사|사무실|오피스|동물병원/i;

function normalize(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/\[[^\]]*\]|\([^)]*\)/g, '')
    .replace(/부산|광역시|본점|지점|점|센터|관|카페|coffee|cafe/g, '')
    .replace(/[^0-9a-z가-힣]/g, '');
}

function haversineM(a, b) {
  const toRad = (degree) => degree * Math.PI / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

async function kakaoCategorySearch(anchor, category, page) {
  const params = new URLSearchParams({
    category_group_code: category.code,
    x: String(anchor.lon),
    y: String(anchor.lat),
    radius: String(SEARCH_RADIUS_M),
    sort: 'distance',
    size: '15',
    page: String(page),
  });
  const response = await fetch(`https://dapi.kakao.com/v2/local/search/category.json?${params}`, {
    headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` },
  });
  if (!response.ok) throw new Error(`Kakao category search failed: ${response.status}`);
  return response.json();
}

function isAlreadyTourApiPlace(place, catalogPlaces) {
  const name = normalize(place.place_name);
  const point = { lat: Number(place.y), lon: Number(place.x) };
  return catalogPlaces.some((tourApi) => {
    if (!tourApi.lat || !tourApi.lon) return false;
    const tourApiName = normalize(tourApi.title);
    const sameOrVariantName = name && tourApiName && (
      name === tourApiName
      || (name.length >= 4 && tourApiName.length >= 4 && (name.includes(tourApiName) || tourApiName.includes(name)))
    );
    const distanceM = haversineM(point, { lat: tourApi.lat, lon: tourApi.lon });
    return sameOrVariantName && distanceM <= 300;
  });
}

function toCandidate(place, category) {
  const lat = Number(place.y);
  const lon = Number(place.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const title = place.place_name?.trim();
  const address = place.road_address_name || place.address_name || '';
  if (!title || !address.startsWith('부산 부산진구') || EXCLUDED_NAME.test(title)) return null;
  const point = { lat, lon };
  const linkedAnchors = TOURISM_ANCHORS
    .map((anchor) => ({ ...anchor, distanceM: haversineM(point, anchor) }))
    .filter((anchor) => anchor.distanceM <= SEARCH_RADIUS_M)
    .sort((a, b) => a.distanceM - b.distanceM);
  if (!linkedAnchors.length) return null;

  return {
    kakaoPlaceId: place.id,
    title,
    address,
    lat,
    lon,
    category: category.category,
    kakaoCategoryName: place.category_name || category.queryLabel,
    dwellProfile: category.dwellProfile,
    tourismEvidence: linkedAnchors.map((anchor) => ({
      tourapiContentId: anchor.contentId,
      anchorTitle: anchor.title,
      context: anchor.context,
      straightDistanceM: anchor.distanceM,
    })),
    mapVerification: {
      provider: 'kakao',
      status: 'verified',
      matchedName: title,
      matchedAddress: address,
      checkedAt: new Date().toISOString(),
    },
    reviewStatus: 'REVIEW',
  };
}

function mergeCandidate(current, incoming) {
  const anchors = new Map(current.tourismEvidence.map((item) => [item.tourapiContentId, item]));
  for (const item of incoming.tourismEvidence) anchors.set(item.tourapiContentId, item);
  return {
    ...current,
    tourismEvidence: [...anchors.values()].sort((a, b) => a.straightDistanceM - b.straightDistanceM),
  };
}

const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf-8'));
const catalogPlaces = [
  ...Object.values(catalog.matched.byContentId),
  ...Object.values(catalog.unmatched.byContentId),
];
const candidatesByPlaceId = new Map();
let requestCount = 0;

for (const anchor of TOURISM_ANCHORS) {
  for (const category of CATEGORY_SEARCHES) {
    for (let page = 1; page <= 3; page += 1) {
      const payload = await kakaoCategorySearch(anchor, category, page);
      requestCount += 1;
      for (const place of payload.documents ?? []) {
        const candidate = toCandidate(place, category);
        if (!candidate || isAlreadyTourApiPlace(place, catalogPlaces)) continue;
        const existing = candidatesByPlaceId.get(candidate.kakaoPlaceId);
        candidatesByPlaceId.set(candidate.kakaoPlaceId, existing ? mergeCandidate(existing, candidate) : candidate);
      }
      if (payload.meta?.is_end) break;
    }
  }
}

const data = [...candidatesByPlaceId.values()]
  .sort((a, b) => {
    const aDistance = a.tourismEvidence[0]?.straightDistanceM ?? Infinity;
    const bDistance = b.tourismEvidence[0]?.straightDistanceM ?? Infinity;
    return aDistance - bDistance || a.title.localeCompare(b.title, 'ko');
  });

const countBy = (values) => values.reduce((result, value) => {
  result[value] = (result[value] ?? 0) + 1;
  return result;
}, {});

const output = {
  meta: {
    generatedAt: new Date().toISOString(),
    targetRegion: '부산 서면·전포',
    purpose: 'TourAPI 관광 거점과 연결된 카카오 장소 C등급 후보의 검토용 목록',
    source: 'Kakao Local category search REST API',
    selectionRule: [
      'TourAPI 관광 거점 900m 이내',
      '부산진구 도로명/지번 주소',
      '카페·음식점·문화시설 카테고리',
      '숙소·주차장·의료·교육·사무시설 등 제외',
      '기존 TourAPI 카탈로그 장소와 중복 제외',
    ],
    note: '자동 선별 후보이며 추천 카탈로그에는 REVIEW 검토 후만 편입한다. 카카오 데이터는 장소 존재·좌표 검증에 사용하고, 체류시간은 AIHub 기반 프로필을 별도로 연결한다.',
  },
  anchors: TOURISM_ANCHORS,
  summary: {
    kakaoRequestCount: requestCount,
    candidates: data.length,
    byCategory: countBy(data.map((item) => item.category)),
    byDwellProfile: countBy(data.map((item) => item.dwellProfile)),
  },
  data,
};

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`);
console.log(`생성 완료: ${OUTPUT_FILE}`);
console.log(`카카오 요청 ${requestCount}건, 검토 후보 ${data.length}개`);
