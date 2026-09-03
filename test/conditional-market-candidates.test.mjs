import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const audit = JSON.parse(fs.readFileSync('data/processed/review/조건부_시장거리_발견후보_감사.json', 'utf8'));
const catalog = JSON.parse(fs.readFileSync('src/data/busan_poi_catalog.json', 'utf8'));
const rows = [...catalog.matched.data, ...catalog.unmatched.data];
const auditById = new Map(audit.data.map((row) => [row.contentId, row]));

test('DATA-MARKET-01: conditional_more만 conditionalVisit으로 감사하며 10:00–18:00 제품 탐색 창을 명시한다', () => {
  assert.deepEqual(audit.summary, { reviewedConditionalTotal: 178, eligibleConditionalVisitTotal: 142, excludedTotal: 36 });
  const eligible = rows.filter((place) => place.conditionalVisit);
  assert.equal(eligible.length, 142);

  for (const place of eligible) {
    assert.equal(place.classification, 'conditional_more');
    assert.equal(place.evidenceProfile.placeKind, 'area');
    assert.ok(['시장', '거리·골목'].includes(place.subCategory));
    assert.deepEqual(place.conditionalVisit, {
      kind: 'market_or_street',
      displayWindow: { start: '10:00', end: '18:00' },
      requiresUserHoursConfirmation: true,
    });
    assert.equal(auditById.get(place.contentId)?.decision, 'conditional_visit');
  }
});

test('DATA-MARKET-01: 대표·area_access·시설·도매/새벽·장기/예약 불확실 장소에는 conditionalVisit을 부여하지 않는다', () => {
  for (const place of rows.filter((row) => row.classification !== 'conditional_more' || row.discovery?.eligibility === 'area_access')) {
    assert.equal(place.conditionalVisit, undefined, `${place.contentId}: non-conditional candidate cannot receive conditionalVisit`);
  }

  for (const contentId of ['poi_90', 'poi_319', 'poi_96', 'poi_99', 'traditional_market_104']) {
    const place = rows.find((row) => row.contentId === contentId);
    assert.ok(place, `${contentId}: fixture place missing`);
    assert.equal(place.conditionalVisit, undefined, `${place.title}: excluded candidate received conditionalVisit`);
    assert.notEqual(auditById.get(contentId)?.decision, 'conditional_visit');
  }
});

test('DATA-MARKET-01: audit은 원본 등급과 운영시간·체류·좌표를 바꾸지 않은 채 모든 조건부 결론을 보존한다', () => {
  const source = JSON.parse(fs.readFileSync('data/processed/review/부산_장소_근거프로필_재분류.json', 'utf8'));
  const sourceById = new Map(source.data.map((place) => [place.id, place]));
  const conditional = rows.filter((place) => place.classification === 'conditional_more');
  assert.equal(conditional.length, 178);

  for (const place of conditional) {
    const original = sourceById.get(place.contentId);
    assert.ok(original, `${place.contentId}: source profile missing`);
    assert.ok(auditById.get(place.contentId), `${place.contentId}: audit entry missing`);
    assert.equal(original.classification, 'conditional_more');
    assert.deepEqual(place.operatingHours, original.operatingHours ?? []);
    assert.deepEqual(
      [place.shortStay.minStayMin, place.shortStay.recommendedStayMin, place.shortStay.maxStayMin],
      [original.minStayMin, original.recommendedStayMin, original.maxStayMin],
    );
    assert.deepEqual([place.lat, place.lon], [original.lat, original.lon]);
  }
});
