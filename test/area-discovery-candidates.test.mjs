import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const auditPath = 'data/processed/review/권역형_발견후보_감사.json';
const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
const catalog = JSON.parse(fs.readFileSync('src/data/busan_poi_catalog.json', 'utf8'));
const rows = [...catalog.matched.data, ...catalog.unmatched.data];
const auditById = new Map(audit.data.map((row) => [row.contentId, row]));

test('DATA-AREA-01/DATA-SUPPLY-01: 369개 런타임 후보는 대표·권역 접근·조건부 발견 자격 하나를 보존한다', () => {
  assert.equal(rows.length, 369);
  assert.equal(audit.data.length, rows.length);
  assert.deepEqual(audit.summary.discoveryEligibility, { representative: 191, area_access: 2, conditional: 176 });

  for (const place of rows) {
    const reviewed = auditById.get(place.contentId);
    assert.ok(reviewed, `${place.contentId}: discovery audit missing`);
    assert.ok(place.discovery, `${place.contentId}: discovery eligibility missing`);
    assert.equal(place.discovery.eligibility, reviewed.discoveryEligibility, `${place.contentId}: audit/runtime eligibility mismatch`);
    assert.ok(['representative', 'area_access', 'conditional'].includes(place.discovery.eligibility));
  }
});

test('DATA-AREA-01: area_access는 공식 공개 야외 접근 근거와 접근 창이 있는 권역만 허용한다', () => {
  const areaAccess = rows.filter((place) => place.discovery?.eligibility === 'area_access');
  assert.deepEqual(areaAccess.map((place) => place.contentId).sort(), ['poi_646', 'poi_662']);

  for (const place of areaAccess) {
    assert.ok(['area', 'outdoor_route'].includes(place.evidenceProfile.placeKind), `${place.title}: non-area access candidate`);
    assert.notEqual(place.availabilityProfile, 'facility', `${place.title}: facility cannot bypass structured hours`);
    assert.equal(place.discovery.accessEvidence?.status, 'public_outdoor_access');
    assert.equal(place.discovery.accessEvidence?.source, 'busan_attraction');
    assert.match(place.discovery.accessEvidence?.checkedAt ?? '', /^2026-08-23$/);
    assert.equal(place.discovery.accessWindow?.kind, 'always');
    assert.deepEqual(place.discovery.accessWindow?.dayTypes, ['weekday', 'weekend']);
  }
});

test('DATA-AREA-01: 내부 점포·시설·근거 없는 거리에는 area_access를 추론하지 않고 대표 입력은 불변이다', () => {
  const original = JSON.parse(fs.readFileSync('data/processed/review/부산_장소_근거프로필_재분류.json', 'utf8'));
  const originalById = new Map(original.data.map((place) => [place.id, place]));

  const facility = rows.find((place) => place.contentId === 'poi_90');
  const unclearStreet = rows.find((place) => place.contentId === 'poi_618');
  assert.equal(facility?.discovery?.eligibility, 'conditional');
  assert.equal(unclearStreet?.discovery?.eligibility, 'conditional');
  assert.equal(unclearStreet?.discovery?.exclusionReason, 'area_access_evidence_missing_or_ambiguous');

  for (const place of rows.filter((row) => row.classification.startsWith('representative_'))) {
    const source = originalById.get(place.contentId);
    assert.ok(source, `${place.contentId}: source profile missing`);
    assert.equal(place.discovery.eligibility, 'representative');
    assert.equal(place.classification, source.classification);
    assert.deepEqual(place.operatingHours, source.operatingHours ?? []);
    assert.deepEqual(
      [place.shortStay.minStayMin, place.shortStay.recommendedStayMin, place.shortStay.maxStayMin],
      [source.minStayMin, source.recommendedStayMin, source.maxStayMin],
    );
    assert.deepEqual([place.lat, place.lon], [source.lat, source.lon]);
  }
});
