#!/usr/bin/env node
// 현재 런타임 카탈로그에서 동일 장소와 포괄 장소/내부 시설 후보를 분리한다.
import fs from 'node:fs';

const CATALOG = 'src/data/busan_poi_catalog.json';
const OUTPUT = 'data/processed/review/현재사용_중복장소후보.json';
const EARTH_RADIUS_M = 6_371_000;
const CHILD_FACILITY = /(자료실|역사문화관|치유의\s*숲|별관|본관|체험관|전시관|주차장|안내소)/;

const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
const places = [...catalog.matched.data, ...catalog.unmatched.data];

function canonicalTitle(title) {
  return String(title ?? '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/^부산\s*/, '')
    .replace(/[\s·ㆍ.,'"!~\-_/&]/g, '')
    .replace(/(본점|직영점|지점)$/, '');
}

function canonicalAddress(address) {
  return String(address ?? '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[\s·ㆍ.,'"!~\-_/&]/g, '')
    .replace(/^부산광역시|^부산시|^부산/, '');
}

function distanceM(a, b) {
  const rad = (value) => value * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const haversine = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(haversine));
}

function compact(place) {
  return {
    contentId: place.contentId,
    title: place.title,
    category: place.category,
    subCategory: place.subCategory ?? null,
    addr1: place.addr1,
    lat: place.lat,
    lon: place.lon,
    sourceEvidence: (place.sourceEvidence ?? []).map((source) => source.source),
    kakaoPlaceUrl: place.mapVerification?.placeUrl ?? null,
  };
}

const pairs = [];
for (let index = 0; index < places.length; index += 1) {
  for (let compareIndex = index + 1; compareIndex < places.length; compareIndex += 1) {
    const first = places[index];
    const second = places[compareIndex];
    const distance = distanceM(first, second);
    if (distance > 150) continue;

    const firstTitle = canonicalTitle(first.title);
    const secondTitle = canonicalTitle(second.title);
    const firstAddress = canonicalAddress(first.addr1);
    const secondAddress = canonicalAddress(second.addr1);
    const sameName = firstTitle.length > 2 && firstTitle === secondTitle;
    const nameContains = Math.min(firstTitle.length, secondTitle.length) >= 4
      && (firstTitle.includes(secondTitle) || secondTitle.includes(firstTitle));
    const sameAddress = firstAddress.length > 5 && firstAddress === secondAddress;

    if (!sameName && !(nameContains && sameAddress)) continue;

    const hasChildFacility = CHILD_FACILITY.test(first.title) !== CHILD_FACILITY.test(second.title);
    const classification = hasChildFacility
      ? '포괄장소_내부시설_검토'
      : sameName && distance <= 100
        ? '동일장소_확정후보'
        : '동일장소_이름차이_검토';
    pairs.push({
      classification,
      distanceM: Math.round(distance),
      sameCanonicalName: sameName,
      sameCanonicalAddress: sameAddress,
      first: compact(first),
      second: compact(second),
    });
  }
}

pairs.sort((a, b) => a.classification.localeCompare(b.classification, 'ko') || a.distanceM - b.distanceM);
const count = (classification) => pairs.filter((pair) => pair.classification === classification).length;
const duplicateCandidateCount = count('동일장소_확정후보') + count('동일장소_이름차이_검토');

const payload = {
  meta: {
    generatedAt: new Date().toISOString(),
    sourceCatalog: CATALOG,
    purpose: '현재 추천 후보의 동일 장소 중복과 포괄 장소/내부 시설 관계를 구분하는 검토 자료',
    rule: '대표 이름 정규화, 주소 정규화, 좌표 150m 이내를 모두 본다. 자동 삭제 전 카카오 장소 ID 또는 실제 장소 페이지로 최종 확인한다.',
  },
  summary: {
    reviewPairCount: pairs.length,
    duplicateCandidateCount,
    confirmedNameDuplicateCount: count('동일장소_확정후보'),
    nameVariantDuplicateCount: count('동일장소_이름차이_검토'),
    parentChildReviewCount: count('포괄장소_내부시설_검토'),
  },
  data: pairs,
};

fs.mkdirSync('data/processed/review', { recursive: true });
fs.writeFileSync(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`중복 검토: 동일 장소 후보 ${duplicateCandidateCount}쌍 / 포괄-내부 검토 ${count('포괄장소_내부시설_검토')}쌍 -> ${OUTPUT}`);
