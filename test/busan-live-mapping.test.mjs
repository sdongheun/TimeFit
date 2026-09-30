import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const manifest = read('data/processed/review/busan_live_mapping_manifest.json');
const fixture = read('data/processed/review/busan_live_mapping_fixture.json');
const audit = read('data/processed/review/busan_live_mapping_audit.json');

test('DATA-BUSAN-LIVE-MAPPING-01: 부산 공식 132장소/133링크와 대표 109곳을 exact UC_SEQ로 보존한다', () => {
  assert.equal(manifest.summary.busanOfficialPlaces, 132);
  assert.equal(manifest.summary.busanOfficialLinks, 133);
  assert.deepEqual(manifest.summary.representative, {
    places: 109,
    links: 110,
    busanOnlyPlaces: 93,
    tourapiAndBusanPlaces: 16,
  });
  assert.equal(manifest.mappings.every((row) => row.joinKey.field === 'UC_SEQ'), true);
  assert.equal(manifest.mappings.every((row) => row.joinKey.match === 'exact_only'), true);
  assert.equal(new Set(manifest.mappings.map((row) => `${row.provider}:${row.sourceId}`)).size, 133);
});

test('DATA-BUSAN-LIVE-MAPPING-01: 저장 근거가 없는 단건 조회·pagination 세부는 unknown이고 완결 목록만 삭제를 판정한다', () => {
  assert.equal(manifest.services.length, 3);
  for (const service of manifest.services) {
    assert.equal(service.storedInput.originalCollectorScript, 'unknown');
    assert.equal(service.requestContract.exactSourceIdRequestSupported, 'unknown');
    assert.equal(service.requestContract.paginationParameterNames, 'unknown');
    assert.equal(service.requestContract.listRequestRequiredForTransition, true);
    assert.match(service.requestContract.deletionRule, /complete list/);
  }
  assert.equal(audit.checks.originalCollectorScriptIdentified, false);
  assert.equal(audit.checks.exactIdOperationProven, false);
});

test('DATA-BUSAN-LIVE-MAPPING-01: 10개 필드 계약은 schema 제공 여부와 앱 소비 경계를 분리한다', () => {
  const expectedFields = ['title', 'address', 'lat', 'lon', 'opening', 'closed', 'description', 'image', 'modified', 'deleted'];
  for (const service of manifest.services) {
    assert.deepEqual(Object.keys(service.fieldContract), expectedFields);
    assert.equal(service.fieldContract.modified.schemaProvidesField, false);
    assert.equal(service.fieldContract.deleted.schemaProvidesField, false);
    assert.equal(service.fieldContract.image.consumption, 'exact_url_rights_gate_else_default_image');
  }
  assert.equal(manifest.services.find((row) => row.provider === 'busan_food').fieldContract.closed.schemaProvidesField, false);
});

test('DATA-BUSAN-LIVE-MAPPING-01: 양쪽 원천 20곳은 최신성·존재·identity gate로 결합하고 공급자 전체 우선순위를 두지 않는다', () => {
  assert.equal(manifest.summary.allTourapiAndBusanPlaces, 20);
  assert.match(manifest.overlapMergeContract.scope, /20/);
  assert.match(manifest.overlapMergeContract.freshnessOrder.join(' '), /never makes its value newer/);
  assert.match(manifest.overlapMergeContract.fields.opening.reviewRequired, /never concatenate/);
  assert.match(manifest.overlapMergeContract.fields.deleted.autoMerge, /every mapped live provider/);
});

test('DATA-BUSAN-LIVE-MAPPING-01: 부산-only 대표는 유지하고 전통시장-only 118곳은 계속 범위 밖이다', () => {
  assert.equal(manifest.summary.representative.busanOnlyPlaces, 93);
  assert.equal(manifest.summary.traditionalMarketOnlyOutOfScope, 118);
  assert.equal(fixture.invariants.traditionalMarketOnlyOutOfScope, 118);
  assert.equal(
    fixture.cases.find((row) => row.id === 'BUSAN-LIVE-MARKET-SCOPE-01').expected,
    'provider_out_of_scope_unchanged',
  );
});
