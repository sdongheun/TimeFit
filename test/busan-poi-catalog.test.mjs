import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const catalog = JSON.parse(fs.readFileSync('src/data/busan_poi_catalog.json', 'utf-8'));
const matched = Object.values(catalog.matched.byContentId);
const unmatched = Object.values(catalog.unmatched.byContentId);

const MATCH_SCOPES = new Set(['direct_place', 'area_context', 'category_fallback', 'bad_match']);
const OPENING_RELIABILITY = new Set(['direct', 'area_uncertain', 'unknown']);
const MAP_VERIFICATION = new Set(['verified', 'weak', 'not_found', 'unverified']);

function byTitle(rows, title) {
  return rows.find((row) => row.title === title);
}

test('부산 POI catalog 기본 구조가 유지된다', () => {
  assert.equal(catalog.meta.targetRegion, '부산');
  assert.ok(matched.length > 0);
  assert.ok(unmatched.length > 0);
  assert.equal(matched.length, catalog.summary.matched);
  assert.equal(unmatched.length, catalog.summary.unmatched);
});

test('matched 장소는 매칭 범위와 출처 메타데이터를 가진다', () => {
  for (const place of matched) {
    assert.ok(MATCH_SCOPES.has(place.matchScope), `${place.title}: invalid matchScope`);
    assert.ok(place.dwellSourceName, `${place.title}: missing dwellSourceName`);
    assert.ok(place.openingHoursSourceName, `${place.title}: missing openingHoursSourceName`);
    assert.ok(OPENING_RELIABILITY.has(place.openingHoursReliability), `${place.title}: invalid openingHoursReliability`);
    assert.ok(MAP_VERIFICATION.has(place.mapVerification?.status), `${place.title}: invalid mapVerification`);
  }
});

test('unmatched 장소는 category_fallback으로만 사용된다', () => {
  for (const place of unmatched) {
    assert.equal(place.matchScope, 'category_fallback', `${place.title}: unmatched must be category_fallback`);
    assert.equal(place.dwellSourceName, `카테고리:${place.category}`);
    assert.ok(place.openingHoursSourceName);
    assert.ok(OPENING_RELIABILITY.has(place.openingHoursReliability));
    assert.ok(MAP_VERIFICATION.has(place.mapVerification?.status), `${place.title}: invalid mapVerification`);
  }
});

test('카카오 지도 검증 실패 장소는 not_found로 분리된다', () => {
  const counts = [...matched, ...unmatched].reduce((acc, place) => {
    acc[place.mapVerification?.status ?? 'unverified'] = (acc[place.mapVerification?.status ?? 'unverified'] ?? 0) + 1;
    return acc;
  }, {});

  assert.equal(counts.unverified ?? 0, 0, 'all catalog places should be checked by Kakao Local');
  assert.ok(counts.verified > 400, 'most catalog places should be verified');
  assert.ok(counts.not_found > 0, 'Kakao not_found places should be explicitly marked');
  assert.ok(counts.weak > 0, 'ambiguous but visible places should be kept as weak');
});

test('명백한 근접 오매칭은 bad_match로 분리된다', () => {
  const examples = [
    ['해운대온천센터', '해운대 밀면'],
    ['성일집', '롯데백화점 광복점'],
    ['남도해양열차 에스트레인(S-train)', '부산역'],
    ['창비부산', '영동 밀면 영동 국밥'],
  ];

  for (const [title, aihubName] of examples) {
    const place = byTitle(matched, title);
    assert.ok(place, `${title}: missing fixture`);
    assert.equal(place.aihubName, aihubName);
    assert.equal(place.matchScope, 'bad_match', `${title}: should be bad_match`);
  }
});

test('시장/거리/골목/상권 맥락 매칭은 area_context로 유지된다', () => {
  const examples = [
    ['부전마켓타운', '부전시장'],
    ['부평동한복거리', '부평 깡통시장'],
    ['신동아 수산물시장', '자갈치시장'],
    ['아리랑거리', '국제시장'],
    ['영도 흰여울해안터널', '흰 여울 문화마을'],
  ];

  for (const [title, aihubName] of examples) {
    const place = byTitle(matched, title);
    assert.ok(place, `${title}: missing fixture`);
    assert.equal(place.aihubName, aihubName);
    assert.equal(place.matchScope, 'area_context', `${title}: should be area_context`);
  }
});

test('추천 후보 수가 과도하게 줄지 않도록 유연한 분포를 유지한다', () => {
  const counts = matched.reduce((acc, place) => {
    acc[place.matchScope] = (acc[place.matchScope] ?? 0) + 1;
    return acc;
  }, {});

  assert.ok(counts.direct_place > counts.area_context, 'direct_place should remain the majority of matched candidates');
  assert.ok(counts.area_context >= 10, 'area_context candidates should remain available');
  assert.ok(counts.bad_match >= 20, 'bad_match filter should catch risky coord-only matches');
});
