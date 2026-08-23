import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const policy = JSON.parse(fs.readFileSync('src/data/area_availability_policy.json', 'utf-8'));
const catalog = JSON.parse(fs.readFileSync('src/data/busan_poi_catalog.json', 'utf-8'));
const rows = [...catalog.matched.data, ...catalog.unmatched.data];
const byId = new Map(rows.map((place) => [place.contentId, place]));

test('권역형 추천 시간대 정책은 공식 시각 범위가 있는 현재 런타임 장소만 담는다', () => {
  const entries = Object.entries(policy.byContentId);
  assert.ok(entries.length > 0);
  for (const [contentId, entry] of entries) {
    const place = byId.get(contentId);
    assert.ok(place, `${contentId}: stale area policy`);
    assert.equal(place.availabilityProfile, 'area', `${place.title}: area profile required`);
    assert.ok(entry.title);
    assert.match(entry.sourceText, /\d{1,2}:\d{2}/, `${entry.title}: source time missing`);
    for (const window of entry.windows) {
      assert.match(window.start, /^\d{2}:\d{2}$/);
      assert.match(window.end, /^\d{2}:\d{2}$/);
      assert.ok(window.start < window.end, `${entry.title}: invalid window`);
    }
  }
});

test('권역형 장소는 시간 정책이 없으면 자동 지도 추천에서 제외할 수 있도록 area 프로필을 사용한다', () => {
  const areaRows = rows.filter((place) => place.availabilityProfile === 'area');
  assert.ok(areaRows.length > 0);
  for (const place of areaRows) {
    assert.ok(['quick_browse', 'compact_culture'].includes(place.shortStay.type), `${place.title}: unexpected area activity`);
  }
});

test('운영시간이 필요한 개별 시설은 facility, 야외 짧은 활동은 outdoor로 구분한다', () => {
  assert.ok(rows.some((place) => place.availabilityProfile === 'facility'));
  assert.ok(rows.some((place) => place.availabilityProfile === 'outdoor'));
  const movie = rows.find((place) => place.title === '부산 영화의 전당');
  if (movie) assert.equal(movie.availabilityProfile, 'facility');
});
