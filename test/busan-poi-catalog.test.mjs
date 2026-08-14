import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const catalog = JSON.parse(fs.readFileSync('src/data/busan_poi_catalog.json', 'utf-8'));
const matched = Object.values(catalog.matched.byContentId);
const unmatched = Object.values(catalog.unmatched.byContentId);
const finalMatched = JSON.parse(fs.readFileSync('data/processed/부산_최종매칭장소.json', 'utf-8'));
const finalUnmatched = JSON.parse(fs.readFileSync('data/processed/부산_최종미매칭장소.json', 'utf-8'));

const MATCH_SCOPES = new Set(['direct_place', 'area_context', 'category_fallback']);
const OPENING_RELIABILITY = new Set(['direct', 'area_uncertain', 'unknown']);
const MAP_VERIFICATION = new Set(['verified', 'weak', 'not_found', 'unverified']);

test('정제 카탈로그 기본 구조와 집계가 일치한다', () => {
  assert.equal(catalog.meta.targetRegion, '부산');
  assert.equal(matched.length, finalMatched.data.length);
  assert.equal(unmatched.length, finalUnmatched.data.length);
  assert.equal(catalog.summary.total, finalMatched.data.length + finalUnmatched.data.length);
  assert.equal(matched.length, catalog.summary.matched);
  assert.equal(unmatched.length, catalog.summary.unmatched);
  assert.equal(catalog.meta.legacyCatalog, 'src/data/busan_poi_catalog.legacy.json');
  assert.equal(finalMatched.summary.records, finalMatched.data.length);
  assert.equal(finalUnmatched.summary.records, finalUnmatched.data.length);
});

test('매칭 장소는 직접 또는 포괄 장소 체류시간 정책만 가진다', () => {
  for (const place of matched) {
    assert.ok(['direct_place', 'area_context'].includes(place.matchScope), `${place.title}: invalid matchScope`);
    assert.ok(place.dwell?.median > 0, `${place.title}: missing dwell median`);
    assert.ok(place.dwell?.count >= 3, `${place.title}: insufficient AI-Hub samples`);
    assert.ok(['name+coord', 'coord'].includes(place.matchType), `${place.title}: invalid AI-Hub match type`);
  }
});

test('미매칭 장소는 카테고리 체류시간 폴백만 사용한다', () => {
  for (const place of unmatched) {
    assert.equal(place.matchScope, 'category_fallback', `${place.title}: invalid fallback policy`);
    assert.equal(place.dwell, undefined, `${place.title}: unmatched must not inherit individual dwell`);
    assert.ok(catalog.categoryDwell[place.category]?.median > 0, `${place.title}: missing category dwell`);
  }
});

test('추천 가능한 모든 장소는 검증된 카카오 상세 링크를 가진다', () => {
  for (const place of [...matched, ...unmatched]) {
    assert.ok(MAP_VERIFICATION.has(place.mapVerification?.status), `${place.title}: invalid Kakao verification status`);
    if (place.mapVerification?.status === 'not_found') continue;
    assert.match(place.mapVerification?.placeUrl ?? '', /^https:\/\/place\.map\.kakao\.com\/\d+$/, `${place.title}: missing Kakao place URL`);
  }
});

test('운영시간 신뢰도는 정제 정책의 세 값만 사용한다', () => {
  for (const place of [...matched, ...unmatched]) {
    assert.ok(OPENING_RELIABILITY.has(place.openingHoursReliability), `${place.title}: invalid opening-hour reliability`);
  }
});

test('부산 공식 관광 데이터의 썸네일은 추천 지도 마커에 사용할 수 있다', () => {
  const placesWithOfficialImage = [...matched, ...unmatched]
    .filter((place) => place.imageSource === 'busan_official');

  assert.ok(placesWithOfficialImage.length >= 450, '부산 공식 이미지 병합 범위가 줄었습니다.');
  for (const place of placesWithOfficialImage) {
    assert.match(place.imageUrl ?? '', /^https:\/\//, `${place.title}: HTTPS 이미지 URL이 필요합니다.`);
  }
});
