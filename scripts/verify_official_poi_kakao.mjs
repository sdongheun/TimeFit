#!/usr/bin/env node
// 부산시 공식 데이터 단독 후보를 카카오 로컬 키워드 검색으로 한 번 검증해 런타임 카탈로그에 저장한다.
import fs from 'node:fs';

const KEY = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY ?? process.env.KAKAO_REST_API_KEY;
if (!KEY) throw new Error('EXPO_PUBLIC_KAKAO_REST_API_KEY 또는 KAKAO_REST_API_KEY가 필요합니다.');

const CATALOG_FILE = 'src/data/busan_poi_catalog.json';
const REPORT_FILE = 'data/processed/review/부산시_공식장소_카카오검증.json';
const CONCURRENCY = Math.max(1, Number(process.env.KAKAO_VERIFY_CONCURRENCY ?? 4));
const LIMIT = Math.max(0, Number(process.env.KAKAO_VERIFY_LIMIT ?? 0));

const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
const all = [...catalog.matched.data, ...catalog.unmatched.data];
const officialOnly = (place) => !(place.sourceEvidence ?? []).some((source) => (
  source.source === 'tourapi_aihub' || source.source === 'tourapi_fallback'
));
const targets = all.filter((place) => officialOnly(place) && place.mapVerification?.status === 'unverified');
const work = LIMIT ? targets.slice(0, LIMIT) : targets;

const normalize = (value = '') => String(value)
  .toLowerCase()
  .replace(/\[[^\]]*]|\([^)]*\)/g, '')
  .replace(/부산|광역시|본점|지점|점|센터|관|카페|coffee|cafe/g, '')
  .replace(/[^0-9a-z가-힣]/g, '');
const similarName = (a, b) => {
  const left = normalize(a);
  const right = normalize(b);
  return !!left && !!right && (left.includes(right) || right.includes(left));
};
const isAreaPlace = (value) => /시장|거리|골목|상권|마을|해수욕장|해변|공원|광장|지하상가|아울렛|백화점|마켓타운|먹자골목|로데오|수산물시장|종합시장|문화마을/.test(value ?? '');
const isAuxiliaryFacility = (value) => /물품보관함|주차장|공중화장실|화장실|전기차충전소|충전소|관리사무소|ATM|현금인출|주유소|정비소/.test(value ?? '');
const distanceM = (a, b) => {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function search(place) {
  const query = new URLSearchParams({ query: place.title, x: String(place.lon), y: String(place.lat), radius: '20000', sort: 'distance', size: '10' });
  const response = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?${query}`, {
    headers: { Authorization: `KakaoAK ${KEY}` },
  });
  if (!response.ok) throw new Error(`Kakao HTTP ${response.status}`);
  const body = await response.json();
  return Array.isArray(body.documents) ? body.documents : [];
}

function classify(place, documents) {
  const candidates = documents.map((document) => {
    const lat = Number(document.y);
    const lon = Number(document.x);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
      placeId: document.id || undefined,
      placeUrl: String(document.place_url ?? '').replace(/^http:/, 'https:') || undefined,
      name: document.place_name || document.road_address_name || document.address_name || '',
      address: document.road_address_name || document.address_name || '',
      distanceM: distanceM(place, { lat, lon }),
      nameSimilar: similarName(place.title, document.place_name),
    };
  }).filter(Boolean).sort((a, b) => Number(b.nameSimilar) - Number(a.nameSimilar) || a.distanceM - b.distanceM);
  const best = candidates[0];
  const checkedAt = new Date().toISOString();
  if (!best) return { provider: 'kakao', status: 'not_found', checkedAt };
  const base = { provider: 'kakao', placeId: best.placeId, placeUrl: best.placeUrl, matchedName: best.name, matchedAddress: best.address, distanceM: best.distanceM, checkedAt };
  if (best.nameSimilar && best.distanceM <= 500 && !isAuxiliaryFacility(best.name)) return { ...base, status: 'verified' };
  if (isAuxiliaryFacility(best.name)) return { ...base, status: 'weak', reason: '장소 본체가 아닌 보조시설 검색 결과' };
  if ((best.nameSimilar && best.distanceM <= 1500) || (isAreaPlace(place.title) && best.distanceM <= 900)) return { ...base, status: 'weak' };
  return { ...base, status: 'not_found' };
}

const results = new Map();
let cursor = 0;
async function worker() {
  while (cursor < work.length) {
    const index = cursor++;
    const place = work[index];
    try {
      results.set(place.contentId, classify(place, await search(place)));
    } catch (error) {
      results.set(place.contentId, { provider: 'kakao', status: 'unverified', error: error instanceof Error ? error.message : String(error), checkedAt: new Date().toISOString() });
      await sleep(250);
    }
    if ((index + 1) % 25 === 0 || index + 1 === work.length) console.log(`카카오 검증 ${index + 1}/${work.length}`);
    await sleep(75);
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, work.length) }, worker));
for (const group of [catalog.matched, catalog.unmatched]) {
  group.data = group.data.map((place) => ({ ...place, mapVerification: results.get(place.contentId) ?? place.mapVerification }));
  group.byContentId = Object.fromEntries(group.data.map((place) => [place.contentId, place]));
}
const current = [...catalog.matched.data, ...catalog.unmatched.data];
const currentOfficial = current.filter(officialOnly);
catalog.summary.mapVerification = current.reduce((counts, place) => {
  const status = place.mapVerification?.status ?? 'unverified';
  counts[status] = (counts[status] ?? 0) + 1;
  return counts;
}, {});
const report = {
  meta: { generatedAt: new Date().toISOString(), provider: 'Kakao Local keyword search', target: '부산시 공식 데이터 단독 후보', rule: 'name similar + 500m=verified, area/name context + 1500m=weak, otherwise not_found' },
  summary: {
    targetTotal: targets.length,
    processed: work.length,
    remaining: currentOfficial.filter((place) => place.mapVerification?.status === 'unverified').length,
    result: currentOfficial.reduce((counts, place) => { const status = place.mapVerification?.status ?? 'unverified'; counts[status] = (counts[status] ?? 0) + 1; return counts; }, {}),
  },
  data: currentOfficial.map((place) => ({ contentId: place.contentId, title: place.title, category: place.category, lat: place.lat, lon: place.lon, mapVerification: place.mapVerification })),
};
fs.writeFileSync(CATALOG_FILE, `${JSON.stringify(catalog, null, 2)}\n`);
fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.summary, null, 2));
