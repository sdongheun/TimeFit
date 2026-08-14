import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const policy = JSON.parse(fs.readFileSync('src/data/area_availability_policy.json', 'utf-8'));
const catalog = JSON.parse(fs.readFileSync('src/data/busan_poi_catalog.json', 'utf-8'));

test('권역형 추천 시간대 정책은 공식 시각 범위가 있는 장소만 담는다', () => {
  const entries = Object.entries(policy.byContentId);
  assert.equal(entries.length, 14);
  for (const [contentId, entry] of entries) {
    assert.match(contentId, /^poi_\d+$/);
    assert.ok(entry.title);
    assert.match(entry.sourceText, /\d{1,2}:\d{2}/, `${entry.title}: source time missing`);
    assert.ok(entry.windows.length > 0);
    for (const window of entry.windows) {
      assert.match(window.start, /^\d{2}:\d{2}$/);
      assert.match(window.end, /^\d{2}:\d{2}$/);
      assert.ok(window.start < window.end, `${entry.title}: invalid window`);
    }
  }
});

test('전포공구길은 개별 상점 매칭이 아닌 권역형 거리 후보로 보류한다', () => {
  const place = catalog.unmatched.byContentId.poi_113;
  assert.ok(place);
  assert.equal(place.title, '전포공구길');
  assert.equal(place.category, '상업지구');
  assert.equal(place.subCategory, '거리·골목');
  assert.equal(place.matchScope, 'category_fallback');
  assert.equal(place.aihubName, undefined);
  assert.equal(policy.byContentId.poi_113, undefined);
});

test('부산 영화의 전당은 자연관광지가 아닌 운영시간 확인 대상 문화시설이다', () => {
  const place = catalog.matched.byContentId.poi_90;
  assert.ok(place);
  assert.equal(place.category, '문화시설');
  assert.match(place.operatingHours[0], /프로그램별 상이/);
});

test('자연관광지 오분류 장소는 추천 가능 성격에 따라 게이트를 탄다', () => {
  const rows = [...catalog.matched.data, ...catalog.unmatched.data];
  const byId = new Map(rows.map((place) => [place.contentId, place]));

  for (const contentId of ['poi_9', 'poi_10', 'poi_16', 'poi_30', 'poi_673']) {
    const place = byId.get(contentId);
    assert.equal(place?.availabilityProfile, 'area', `${contentId}: expected area profile`);
    assert.equal(place?.category, '상업지구', `${contentId}: expected commercial category`);
  }
  for (const contentId of ['poi_17', 'poi_24', 'poi_28', 'poi_35', 'poi_56', 'poi_76', 'poi_94', 'poi_97', 'poi_650']) {
    assert.equal(byId.get(contentId)?.availabilityProfile, 'facility', `${contentId}: expected facility profile`);
  }
  assert.equal(byId.get('poi_37')?.availabilityProfile, 'hold');
  assert.equal(byId.get('poi_81')?.availabilityProfile, 'hold');
  assert.equal(byId.has('poi_65'), false, 'S-train must not remain in the runtime catalog');
});
