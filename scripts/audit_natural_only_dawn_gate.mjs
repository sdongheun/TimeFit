#!/usr/bin/env node
// 자연관광지 외 장소가 자정 추천 게이트를 우회하는지 점검한다.
import fs from 'node:fs';

const KEY = process.env.EXPO_PUBLIC_TOURAPI_KEY;
if (!KEY) throw new Error('EXPO_PUBLIC_TOURAPI_KEY가 필요합니다. .env를 불러온 뒤 실행하세요.');

const CATALOG = 'src/data/busan_poi_catalog.json';
const OUTPUT = 'data/processed/review/새벽_비자연관광_게이트감사.json';
const API = 'https://apis.data.go.kr/B551011/KorService2/detailIntro2';
const FIELD_BY_TYPE = { '12': 'usetime', '14': 'usetimeculture', '15': 'usetimefestival', '28': 'usetimeleports', '38': 'opentime', '39': 'opentimefood' };

const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
const policy = JSON.parse(fs.readFileSync('src/data/area_availability_policy.json', 'utf8'));
const rows = [...catalog.matched.data, ...catalog.unmatched.data];

function isAreaDependent(place) {
  return (place.category === '상업지구' || place.category === '문화시설')
    && /시장|거리|골목|문화마을/.test(place.subCategory ?? '');
}

function isPaidFacilityLike(place) {
  return ['카페', '식당', '문화시설', '레저/스포츠'].includes(place.category)
    || (place.category === '상업지구' && /개별상점|아울렛/.test(place.subCategory ?? ''));
}

function parseRange(hours) {
  const match = String(hours ?? '').match(/(\d{1,2}):(\d{2})\s*[~\-]\s*(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}~${match[3].padStart(2, '0')}:${match[4]}` : null;
}

async function detailHours(place) {
  if (!place.tourapiContentId || !place.tourapiContentTypeId) return null;
  const params = new URLSearchParams({
    serviceKey: KEY, MobileOS: 'ETC', MobileApp: 'TimeFit', _type: 'json',
    contentId: place.tourapiContentId, contentTypeId: place.tourapiContentTypeId,
  });
  const response = await fetch(`${API}?${params}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  const items = json?.response?.body?.items?.item;
  const item = Array.isArray(items) ? items[0] : items;
  return item?.[FIELD_BY_TYPE[place.tourapiContentTypeId]] ?? null;
}

const obviousBypass = rows.filter((place) => {
  if (place.category === '자연관광지' || place.mapVerification?.status === 'not_found') return false;
  if (isAreaDependent(place) || isPaidFacilityLike(place)) return false;
  return !parseRange(place.operatingHours?.[0]);
});

const data = [];
for (const place of obviousBypass) {
  let tourapiHours = null;
  let error = null;
  try { tourapiHours = await detailHours(place); } catch (cause) { error = String(cause); }
  const effectiveHours = parseRange(tourapiHours);
  data.push({
    contentId: place.contentId,
    title: place.title,
    category: place.category,
    subCategory: place.subCategory ?? null,
    catalogHours: place.operatingHours ?? [],
    tourapiHours,
    status: effectiveHours ? '새벽차단가능_시간범위확인' : '새벽우회위험',
    reason: effectiveHours ? `TourAPI 시간 ${effectiveHours}` : error ?? '시설형·권역형 분류 밖이며 시간 범위가 없음',
  });
}

const summary = Object.fromEntries([...data.reduce((counts, row) => {
  counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  return counts;
}, new Map()).entries()]);
fs.writeFileSync(OUTPUT, `${JSON.stringify({
  meta: {
    generatedAt: new Date().toISOString(),
    rule: '자연관광지 외에는 시간 범위 또는 별도 권역형 정책이 없으면 자정 추천에서 제외되어야 한다.',
  },
  summary: { checked: data.length, byStatus: summary },
  data,
}, null, 2)}\n`);
console.log(`새벽 비자연관광 게이트 감사: ${data.length}건 -> ${OUTPUT}`);
