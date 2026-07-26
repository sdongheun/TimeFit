#!/usr/bin/env node
// 기존 부산 POI JSON에 매칭 범위/체류 출처/운영시간 신뢰도 메타데이터를 부여한다.
import fs from 'node:fs';
import path from 'node:path';

const MATCHED_FILE = path.resolve('data/processed/부산_매칭장소.json');
const UNMATCHED_FILE = path.resolve('data/processed/부산_미매칭_TourAPI장소.json');
const CATALOG_FILE = path.resolve('src/data/busan_poi_catalog.json');

const AREA_RE = /시장|거리|골목|상권|마을|해수욕장|해변|공원|광장|지하상가|아울렛|백화점|마켓타운|먹자골목|로데오|수산물시장|종합시장|문화마을/;
const AREA_SUBCATEGORIES = new Set(['전통시장', '전문상가', '거리/골목상권']);
const SHOPPING_AREA_SUBCATEGORIES = new Set(['전통시장', '전문상가', '거리/골목상권', '백화점/쇼핑몰', '아울렛']);

const norm = (s = '') => String(s)
  .toLowerCase()
  .replace(/\[[^\]]*]|\([^)]*\)/g, '')
  .replace(/부산|광역시|본점|지점|점|센터|관|카페|coffee|cafe/g, '')
  .replace(/[^0-9a-z가-힣]/g, '');

function isSimilarPlaceName(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

function isAreaLike(value) {
  return AREA_RE.test(String(value ?? ''));
}

function isCategoryCompatible(place) {
  if (!place.aihubCategory) return true;
  if (place.aihubCategory === place.category) return true;
  if (place.category === '카페' && place.aihubCategory === '식당') return true;
  if (place.category === '상업지구' && ['상업지구', '상점'].includes(place.aihubCategory)) return true;
  if (place.category === '자연관광지' && ['산책로/둘레길', '체험활동관광지', '테마시설', '역사/유적/종교'].includes(place.aihubCategory)) return true;
  if (place.category === '문화시설' && ['역사/유적/종교', '테마시설'].includes(place.aihubCategory)) return true;
  return false;
}

function riskCount(place) {
  return [
    place.matchType === 'coord',
    (place.matchDistanceM ?? 0) > 50,
    (place.dwell?.count ?? 0) < 5,
    !!place.aihubName && !isSimilarPlaceName(place.title, place.aihubName),
    !!place.aihubCategory && !isCategoryCompatible(place),
  ].filter(Boolean).length;
}

function matchScopeFor(place) {
  if (place.matchType === 'name+coord' || isSimilarPlaceName(place.title, place.aihubName)) return 'direct_place';

  const areaContext =
    place.matchType === 'coord' &&
    (SHOPPING_AREA_SUBCATEGORIES.has(place.subCategory) || isAreaLike(place.title) || isAreaLike(place.aihubName)) &&
    isCategoryCompatible(place);

  if (areaContext) return 'area_context';
  if (!isCategoryCompatible(place) && riskCount(place) >= 3) return 'bad_match';
  if (riskCount(place) >= 4) return 'bad_match';
  return 'direct_place';
}

function openingReliabilityFor(place) {
  if (place.category === '자연관광지') return 'unknown';
  if (AREA_SUBCATEGORIES.has(place.subCategory) || isAreaLike(place.title)) return 'area_uncertain';
  return 'direct';
}

function enrichMatched(place) {
  const matchScope = matchScopeFor(place);
  return {
    ...place,
    matchScope,
    dwellSourceName: place.aihubName ?? place.title,
    openingHoursSourceName: place.title,
    openingHoursReliability: openingReliabilityFor(place),
  };
}

function enrichUnmatched(place) {
  return {
    ...place,
    matchScope: 'category_fallback',
    dwellSourceName: `카테고리:${place.category}`,
    openingHoursSourceName: place.title,
    openingHoursReliability: openingReliabilityFor(place),
  };
}

function rewriteCollection(payload, kind) {
  const fn = kind === 'matched' ? enrichMatched : enrichUnmatched;
  payload.data = (payload.data ?? []).map(fn);
  payload.byContentId = Object.fromEntries(payload.data.map((p) => [String(p.contentId), p]));
  payload.summary = {
    ...(payload.summary ?? {}),
    matchScope: countBy(payload.data, 'matchScope'),
    openingHoursReliability: countBy(payload.data, 'openingHoursReliability'),
  };
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] ?? 'unknown';
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function writeJson(file, payload) {
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
}

const matched = JSON.parse(fs.readFileSync(MATCHED_FILE, 'utf-8'));
const unmatched = JSON.parse(fs.readFileSync(UNMATCHED_FILE, 'utf-8'));
const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf-8'));

rewriteCollection(matched, 'matched');
rewriteCollection(unmatched, 'unmatched');

catalog.matched = matched;
catalog.unmatched = unmatched;
catalog.summary = {
  ...(catalog.summary ?? {}),
  matched: matched.data.length,
  unmatched: unmatched.data.length,
  matchedMatchScope: matched.summary.matchScope,
  unmatchedOpeningHoursReliability: unmatched.summary.openingHoursReliability,
};

writeJson(MATCHED_FILE, matched);
writeJson(UNMATCHED_FILE, unmatched);
writeJson(CATALOG_FILE, catalog);

console.log('부산 POI 매칭 범위 메타데이터 반영 완료');
console.log('matched matchScope', matched.summary.matchScope);
console.log('matched openingHoursReliability', matched.summary.openingHoursReliability);
console.log('unmatched openingHoursReliability', unmatched.summary.openingHoursReliability);
