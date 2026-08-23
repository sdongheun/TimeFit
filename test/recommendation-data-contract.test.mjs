import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const catalog = JSON.parse(fs.readFileSync('src/data/busan_poi_catalog.json', 'utf-8'));
const source = JSON.parse(fs.readFileSync('data/processed/review/부산_자투리장소_카탈로그_초안.json', 'utf-8'));
const rows = [...catalog.matched.data, ...catalog.unmatched.data];

test('앱에서 사용하는 짧은 체류 카테고리만 런타임 카탈로그에 남아 있다', () => {
  const allowed = new Set(['자연관광지', '상업지구', '레저/스포츠', '문화시설', '카페']);
  for (const place of rows) assert.ok(allowed.has(place.category), `${place.title}: unexpected ${place.category}`);
});

test('숙박·교통·의료·주차와 일반 식당은 자투리 활동 후보에서 제외되어 있다', () => {
  const excluded = /호텔|모텔|리조트|숙박|숙소|게스트하우스|펜션|여관|호스텔|콘도|병원|주차장|여객터미널|버스터미널|철도역|기차역|지하철역/;
  assert.deepEqual(rows.filter((place) => excluded.test(place.title)).map((place) => place.title), []);
  assert.deepEqual(rows.filter((place) => place.category === '식당').map((place) => place.title), []);
});

test('포괄 장소 내부의 개별 시설은 대표 장소로 바꾸거나 보류·제외 기록에 남긴다', () => {
  const activeIds = new Set(rows.map((place) => place.contentId));
  const activeSource = source.data.filter((place) => activeIds.has(place.id));
  assert.deepEqual(activeSource.filter((place) => place.scope?.type === '내부장소').map((place) => place.title), []);
});

test('같은 이름의 일반명 백화점은 없고 명확한 대표 백화점은 운영시간과 함께만 남는다', () => {
  assert.equal(rows.some((place) => place.title === '백화점'), false);
  const lotte = rows.find((place) => place.title === '롯데백화점 부산본점');
  if (lotte) assert.match(lotte.operatingHours?.[0] ?? '', /10:30/);
});

test('런타임 권장 체류는 AI-Hub 활동 대응 카테고리의 최빈값 30분을 사용한다', () => {
  for (const place of rows) {
    assert.ok(place.shortStay, `${place.title}: short-stay policy missing`);
    const reference = place.shortStay.dwellReference;
    assert.ok(reference, `${place.title}: AI-Hub dwell reference missing`);
    assert.equal(reference.kind, 'category_mode', `${place.title}: category mode reference`);
    assert.equal(reference.mode, 30, `${place.title}: category mode`);
    assert.equal(place.shortStay.minStayMin, 20, `${place.title}: flexible minimum`);
    assert.equal(place.shortStay.recommendedStayMin, 30, `${place.title}: recommended mode`);
    assert.equal(place.shortStay.maxStayMin, place.shortStay.type === 'compact_culture' ? 120 : 60, `${place.title}: activity maximum`);
  }
});
