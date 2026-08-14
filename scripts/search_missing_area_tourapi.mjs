#!/usr/bin/env node
// 권역형 장소 중 TourAPI 원본 ID가 없는 후보를 키워드+좌표로 재탐색한다.
import fs from 'node:fs';

const KEY = process.env.EXPO_PUBLIC_TOURAPI_KEY;
if (!KEY) throw new Error('EXPO_PUBLIC_TOURAPI_KEY가 필요합니다. .env를 불러온 뒤 실행하세요.');

const REVIEW = 'data/processed/review/권역형장소_운영시간근거_검토.json';
const CATALOG = 'src/data/busan_poi_catalog.json';
const OUTPUT = 'data/processed/review/권역형장소_TourAPI키워드재탐색_검토.json';
const API = 'https://apis.data.go.kr/B551011/KorService2/searchKeyword2';

const review = JSON.parse(fs.readFileSync(REVIEW, 'utf8'));
const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
const byContentId = new Map([...catalog.matched.data, ...catalog.unmatched.data].map((place) => [place.contentId, place]));
const targets = review.data
  .filter((row) => row.priority === '1순위')
  .map((row) => ({ row, place: byContentId.get(row.contentId) }))
  .filter(({ place }) => place && !place.tourapiContentId);

function normalized(value = '') {
  return String(value).toLowerCase().replace(/\s|[-·ㆍ()]/g, '');
}

function distanceM(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

async function search(place) {
  const params = new URLSearchParams({
    serviceKey: KEY,
    MobileOS: 'ETC',
    MobileApp: 'TimeFit',
    _type: 'json',
    keyword: place.title,
    areaCode: '6',
    numOfRows: '10',
    pageNo: '1',
  });
  const response = await fetch(`${API}?${params}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  const items = json?.response?.body?.items?.item ?? [];
  return (Array.isArray(items) ? items : [items]).map((item) => {
    const lat = Number(item.mapy);
    const lon = Number(item.mapx);
    const candidate = {
      contentId: item.contentid,
      contentTypeId: item.contenttypeid,
      title: item.title,
      addr1: item.addr1,
      distanceM: Number.isFinite(lat) && Number.isFinite(lon) ? Math.round(distanceM(place, { lat, lon })) : null,
    };
    const titleSame = normalized(item.title) === normalized(place.title);
    return { ...candidate, exactNameAndNearby: titleSame && (candidate.distanceM ?? Infinity) <= 250 };
  });
}

const results = [];
for (const { row, place } of targets) {
  try {
    const candidates = await search(place);
    results.push({
      contentId: row.contentId,
      title: row.title,
      addr1: place.addr1,
      status: candidates.some((candidate) => candidate.exactNameAndNearby) ? '직접매핑후보있음' : '직접매핑후보없음',
      candidates,
    });
  } catch (error) {
    results.push({ contentId: row.contentId, title: row.title, addr1: place.addr1, status: '조회실패', error: String(error) });
  }
}

const byStatus = Object.fromEntries([...results.reduce((counts, row) => {
  counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  return counts;
}, new Map()).entries()]);
fs.writeFileSync(OUTPUT, `${JSON.stringify({
  meta: {
    generatedAt: new Date().toISOString(),
    source: 'TourAPI KorService2 searchKeyword2',
    purpose: 'TourAPI 원본 ID가 없는 권역형 장소의 공식 상세 운영시간 확보 가능성을 재검토한다.',
    rule: '이름 완전 일치와 250m 이내 좌표가 모두 충족돼야만 detailIntro2 재조회 후보로 사용한다.',
  },
  summary: { queried: results.length, byStatus },
  data: results,
}, null, 2)}\n`);
console.log(`권역형 장소 TourAPI 키워드 재탐색: ${results.length}건 -> ${OUTPUT}`);
