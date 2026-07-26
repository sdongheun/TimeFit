import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const catalog = JSON.parse(fs.readFileSync('src/data/busan_poi_catalog.json', 'utf-8'));
const matched = Object.values(catalog.matched.byContentId);
const unmatched = Object.values(catalog.unmatched.byContentId);

test('앱에서 사용하는 추천 카테고리만 catalog에 남아 있다', () => {
  const allowed = new Set(['자연관광지', '상업지구', '레저/스포츠', '문화시설', '식당', '카페']);
  const categories = new Set([...matched, ...unmatched].map((place) => place.category));

  for (const category of categories) {
    assert.ok(allowed.has(category), `unexpected category: ${category}`);
  }
});

test('숙박성 장소는 추천 catalog에서 제외되어 있다', () => {
  const lodging = /호텔|모텔|리조트|숙박|숙소|게스트하우스|펜션|여관|호스텔|콘도/;
  const leaked = [...matched, ...unmatched].filter((place) => lodging.test(place.title));
  assert.deepEqual(leaked.map((place) => place.title), []);
});

test('상업지구 matched는 수동 세부 카테고리 검토 결과를 가진다', () => {
  const commercial = matched.filter((place) => place.category === '상업지구');
  assert.ok(commercial.length > 0);

  for (const place of commercial) {
    assert.ok(place.subCategory, `${place.title}: missing subCategory`);
    assert.equal(place.subCategorySource, 'manual_commercial_review', `${place.title}: missing manual review source`);
  }
});

test('체류시간 통계는 추천 가능한 분 단위 범위를 가진다', () => {
  for (const place of matched) {
    assert.ok(Number.isInteger(place.dwell.median), `${place.title}: dwell median should be integer`);
    assert.ok(place.dwell.median >= 10 && place.dwell.median <= 240, `${place.title}: dwell median out of zaturi range`);
    assert.ok(place.dwell.count >= 3, `${place.title}: AI-Hub sample count should be >= 3`);
  }

  for (const [category, stat] of Object.entries(catalog.categoryDwell)) {
    assert.ok(Number.isInteger(stat.median), `${category}: category median should be integer`);
    assert.ok(stat.median >= 10 && stat.median <= 240, `${category}: category median out of zaturi range`);
    assert.ok(stat.count >= 3, `${category}: category sample count should be >= 3`);
  }
});
