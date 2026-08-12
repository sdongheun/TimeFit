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

test('포괄 장소 내부 후보는 런타임 카탈로그에 포함되지 않는다', () => {
  const review = JSON.parse(fs.readFileSync('data/processed/review/부산_최종장소_보류.json', 'utf-8'));
  const runtimeIds = new Set(rows.map((place) => place.contentId));
  const internal = review.data.filter((place) => place.scope?.type === '내부장소');
  assert.ok(internal.length > 0);
  for (const place of internal) assert.equal(runtimeIds.has(place.id), false, `${place.title}: internal place leaked into runtime catalog`);
});

test('카테고리 체류시간 통계는 추천 가능한 분 단위 범위를 가진다', () => {
  for (const [category, stat] of Object.entries(catalog.categoryDwell)) {
    assert.ok(Number.isInteger(stat.median), `${category}: median should be an integer`);
    assert.ok(stat.median >= 10 && stat.median <= 240, `${category}: median out of range`);
    assert.ok(stat.count >= 3, `${category}: insufficient samples`);
  }
});
