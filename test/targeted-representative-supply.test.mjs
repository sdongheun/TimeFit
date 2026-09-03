import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const audit = JSON.parse(fs.readFileSync('data/processed/review/생활권_대표후보_보강_감사.json', 'utf8'));
const profile = JSON.parse(fs.readFileSync('data/processed/review/부산_장소_근거프로필_재분류.json', 'utf8'));
const runtime = JSON.parse(fs.readFileSync('src/data/busan_poi_catalog.json', 'utf8'));
const places = [...runtime.matched.data, ...runtime.unmatched.data];

test('DATA-SUPPLY-01: 제한 후보 22개는 네 생활권과 최종 판정을 빠짐없이 보존한다', () => {
  assert.equal(audit.summary.candidateTotal, 22);
  assert.ok(audit.summary.candidateTotal <= 60);
  assert.deepEqual(audit.summary.byFinalClassification, {
    conditional_more: 18,
    hold: 3,
    representative_standard: 1,
  });
  assert.equal(audit.data.length, audit.summary.candidateTotal);
  assert.deepEqual(new Set(audit.data.map((row) => row.livingArea)), new Set(['서면·전포', '사상↔서면', '부산역·남포', '센텀·해운대']));
  for (const row of audit.data) {
    assert.ok(['representative_standard', 'conditional_more', 'hold'].includes(row.finalClassification));
    assert.ok(row.decisionReason);
    assert.ok(row.siteGroupDecision);
  }
});

test('DATA-SUPPLY-01: 공식 시장 접근 시간으로 확인된 부평깡통시장만 standard로 승격한다', () => {
  const promoted = audit.data.filter((row) => row.finalClassification === 'representative_standard');
  assert.deepEqual(promoted.map((row) => row.placeId), ['poi_4']);
  assert.equal(promoted[0].officialEvidence.url, 'https://www.bsjunggu.go.kr/board/view.junggu?CATEGORY_CODE2=A01%2CA02%2CA03%2CB02%2CB03%2CC01%2CC02%2CC03%2CD01%2CD02%2CD04&CATEGORY_CODE3=&boardId=LIFE&dataSid=55998&keyword=&menuCd=DOM_000000201001000000&nowPage=2&searchType=DATA_TITLE');
  assert.equal(promoted[0].availability.windows[0].start, '09:00');
  assert.equal(promoted[0].availability.windows[0].end, '20:00');

  const profilePlace = profile.data.find((place) => place.id === 'poi_4');
  const runtimePlace = places.find((place) => place.contentId === 'poi_4');
  assert.equal(profilePlace.classification, 'representative_standard');
  assert.equal(profilePlace.availability, 'area_hours');
  assert.deepEqual(runtimePlace.operatingHours, ['매일 09:00~20:00']);
  assert.equal(runtimePlace.classification, 'representative_standard');
});

test('DATA-SUPPLY-01: 기존 대표 190개와 비승격 후보의 공개 데이터는 바꾸지 않는다', () => {
  assert.deepEqual(audit.baseline.representativeIds, audit.after.representativeIds.filter((id) => id !== 'poi_4'));
  assert.equal(audit.baseline.representativeIds.length, 190);
  assert.equal(audit.after.representativeIds.length, 191);

  for (const row of audit.data.filter((item) => item.placeId !== 'poi_4')) {
    const place = profile.data.find((item) => item.id === row.placeId);
    assert.equal(place.classification, row.previousClassification, `${row.placeId}: classification must remain`);
  }
});
