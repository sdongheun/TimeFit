import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const catalog = JSON.parse(fs.readFileSync('src/data/busan_poi_catalog.json', 'utf-8'));
const rows = [...catalog.matched.data, ...catalog.unmatched.data];

test('앱에서 사용하는 추천 카테고리만 정제 카탈로그에 남아 있다', () => {
  const allowed = new Set(['자연관광지', '상업지구', '레저/스포츠', '문화시설', '식당', '카페']);
  for (const place of rows) assert.ok(allowed.has(place.category), `${place.title}: unexpected ${place.category}`);
});

test('숙박·교통·의료·주차 시설은 추천 카탈로그에서 제외되어 있다', () => {
  const excluded = /호텔|모텔|리조트|숙박|숙소|게스트하우스|펜션|여관|호스텔|콘도|병원|주차장|여객터미널|버스터미널|철도역|기차역|지하철역/;
  assert.deepEqual(rows.filter((place) => excluded.test(place.title)).map((place) => place.title), []);
});

test('포괄 장소와 내부 시설은 각각 유지하되 동일 장소 그룹으로 묶인다', () => {
  const grouped = rows.filter((place) => place.siteGroupId);
  assert.equal(grouped.length, 8);
  const groups = new Map();
  for (const place of grouped) groups.set(place.siteGroupId, [...(groups.get(place.siteGroupId) ?? []), place]);
  assert.equal(groups.size, 4);
  for (const [groupId, places] of groups) {
    assert.equal(places.length, 2, `${groupId}: expected parent and child`);
    assert.deepEqual(new Set(places.map((place) => place.siteRole)), new Set(['parent', 'child']), `${groupId}: invalid roles`);
  }
});

test('이름 차이 중복의 탈락 레코드는 대표 장소에 병합된다', () => {
  const runtimeIds = new Set(rows.map((place) => place.contentId));
  const mergedIds = rows.flatMap((place) => place.mergedPlaceIds ?? []);
  assert.equal(mergedIds.length, 11);
  for (const contentId of mergedIds) assert.equal(runtimeIds.has(contentId), false, `${contentId}: duplicate remains in runtime catalog`);
});

test('일반명 백화점 중복은 제거하고 운영시간이 있는 대표 백화점만 유지한다', () => {
  assert.equal(rows.some((place) => place.title === '백화점'), false);
  const lotte = rows.find((place) => place.title === '롯데백화점 부산본점');
  assert.ok(lotte);
  assert.match(lotte.operatingHours?.[0] ?? '', /10:30/);
});

test('카테고리 체류시간 통계는 추천 가능한 분 단위 범위를 가진다', () => {
  for (const [category, stat] of Object.entries(catalog.categoryDwell)) {
    assert.ok(Number.isInteger(stat.median), `${category}: median should be an integer`);
    assert.ok(stat.median >= 10 && stat.median <= 240, `${category}: median out of range`);
    assert.ok(stat.count >= 3, `${category}: insufficient samples`);
  }
});
