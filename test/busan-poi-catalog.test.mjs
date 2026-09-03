import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const catalog = JSON.parse(fs.readFileSync('src/data/busan_poi_catalog.json', 'utf-8'));
const source = JSON.parse(fs.readFileSync('data/processed/review/부산_장소_근거프로필_재분류.json', 'utf-8'));
const rows = [...catalog.matched.data, ...catalog.unmatched.data];

const SHORT_STAY_TYPES = new Set(['scenic_pause', 'quick_browse', 'compact_culture', 'quick_rest']);
const OPENING_RELIABILITY = new Set(['direct', 'area_uncertain', 'unknown']);
const MAP_VERIFICATION = new Set(['verified', 'weak', 'not_found', 'unverified']);

test('런타임 카탈로그는 검토한 자투리 활동 장소를 정확히 사용한다', () => {
  const activeSource = source.data.filter((place) => ['representative_core', 'representative_standard', 'conditional_more'].includes(place.classification));
  assert.equal(catalog.meta.targetRegion, '부산');
  assert.equal(catalog.meta.sourceCatalog, 'data/processed/review/부산_장소_근거프로필_재분류.json');
  assert.match(catalog.meta.compatibility, /approved\/conditional/);
  assert.match(catalog.meta.compatibility, /classification/);
  assert.equal(rows.length, activeSource.length);
  assert.equal(catalog.summary.total, activeSource.length);
  assert.equal(catalog.summary.matched + catalog.summary.unmatched, activeSource.length);
  assert.deepEqual(catalog.summary.classification, { representative_core: 28, conditional_more: 178, representative_standard: 163 });
});

test('모든 런타임 장소는 짧은 활동 유형과 최소·권장·최대 체류 범위를 가진다', () => {
  for (const place of rows) {
    const policy = place.shortStay;
    assert.ok(policy, `${place.title}: shortStay policy required`);
    assert.ok(SHORT_STAY_TYPES.has(policy.type), `${place.title}: invalid activity type`);
    assert.ok(policy.minStayMin > 0, `${place.title}: minimum stay`);
    assert.ok(policy.minStayMin <= policy.recommendedStayMin, `${place.title}: recommended stay`);
    assert.ok(policy.recommendedStayMin <= policy.maxStayMin, `${place.title}: maximum stay`);
    assert.ok(['approved', 'conditional'].includes(policy.selectionStatus), `${place.title}: selection status`);
    assert.ok(['representative_core', 'representative_standard', 'conditional_more'].includes(place.classification), `${place.title}: classification`);
  }
});

test('직접 AI-Hub 매칭만 매칭 그룹에 두고 나머지는 활동 정책으로 사용한다', () => {
  for (const place of catalog.matched.data) {
    assert.ok(['direct_place', 'area_context'].includes(place.matchScope), `${place.title}: matched scope`);
    assert.equal(place.matchType, 'name+coord', `${place.title}: exact match type`);
    assert.ok(place.matchDistanceM <= 100, `${place.title}: exact match distance`);
  }
  for (const place of catalog.unmatched.data) {
    assert.equal(place.matchScope, 'category_fallback', `${place.title}: fallback scope`);
    assert.ok(place.shortStay, `${place.title}: conditional activity policy required`);
  }
});

test('카카오 확인 링크와 운영시간 신뢰도는 장소별로 추적된다', () => {
  for (const place of rows) {
    assert.ok(MAP_VERIFICATION.has(place.mapVerification?.status), `${place.title}: map status`);
    assert.match(place.mapVerification?.placeUrl ?? '', /^https:\/(?:\/map\.kakao\.com\/link\/search\/|\/place\.map\.kakao\.com\/\d+$)/, `${place.title}: Kakao URL`);
    assert.ok(OPENING_RELIABILITY.has(place.openingHoursReliability), `${place.title}: opening-hour reliability`);
  }
});

test('TourAPI HTTPS 검증 이미지는 동일 content ID에만 보완 원천으로 붙고 부산시 공식 이미지를 덮어쓰지 않는다', () => {
  const tourapiImages = rows.filter((place) => place.imageSource === 'tourapi');
  const representative = tourapiImages.filter((place) => ['representative_core', 'representative_standard'].includes(place.classification));
  assert.equal(representative.length, 72);
  assert.ok(tourapiImages.some((place) => place.contentId === 'poi_41'), 'previously validated conditional image is retained');
  for (const place of tourapiImages) {
    assert.equal(place.tourapiContentId, place.imageEvidence.sourceId);
    assert.match(place.imageUrl, /^https:\/\//);
    assert.match(place.imageEvidence.auditedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.match(place.imageEvidence.httpsValidatedAt, /^\d{4}-\d{2}-\d{2}T/);
  }
  for (const place of rows.filter((item) => item.imageSource === 'busan_official')) assert.notEqual(place.imageSource, 'tourapi');
});

test('일반 식당과 숙박·교통·의료·주차 시설은 런타임 자투리 활동 카탈로그에 없다', () => {
  const excluded = /호텔|모텔|리조트|숙박|숙소|게스트하우스|펜션|여관|호스텔|콘도|병원|주차장|여객터미널|버스터미널|철도역|기차역|지하철역/;
  assert.deepEqual(rows.filter((place) => excluded.test(place.title)).map((place) => place.title), []);
  assert.deepEqual(rows.filter((place) => place.category === '식당').map((place) => place.title), []);
});
