import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const fixture = JSON.parse(fs.readFileSync('test/fixtures/busan-live-contract.fixture.json', 'utf8'));
const sourceNames = ['busan_attraction', 'busan_food', 'busan_shopping'];

test('API-BUSAN-LIVE-CONTRACT-01: 요청은 승인된 exact source ID와 snapshot ID만 받고 위치를 받지 않는다', () => {
  assert.deepEqual(Object.keys(fixture.request.approvedSourceIds), sourceNames);
  assert.equal(fixture.providerPolicy.userCoordinatesSent, false);
  assert.equal(fixture.providerPolicy.rawProviderBodyPersisted, false);
  assert.equal(fixture.providerPolicy.staleFallbackAllowed, false);
  assert.doesNotMatch(JSON.stringify(fixture.request), /latitude|longitude|\blat\b|\blng\b|userId|serviceKey/i);
});

test('API-BUSAN-LIVE-CONTRACT-01: 전체 목록은 원천당 2페이지, snapshot당 6회로 fail-closed한다', () => {
  assert.equal(fixture.providerPolicy.pageSize, 500);
  assert.equal(fixture.providerPolicy.maxPagesPerSource, 2);
  assert.equal(fixture.providerPolicy.maxProviderCallsPerSnapshot, 6);
  assert.equal(fixture.providerPolicy.automaticRetries, 0);
  assert.deepEqual(fixture.providerPolicy.requestFields, ['ServiceKey', 'pageNo', 'numOfRows', 'resultType']);
  assert.equal(fixture.cases.pageIncomplete.sources.busan_attraction.status, 'unavailable');
  assert.equal(fixture.cases.pageIncomplete.sources.busan_attraction.reason, 'page_limit');
  assert.equal('inactiveApprovedSourceIds' in fixture.cases.pageIncomplete.sources.busan_attraction, false);
});

test('API-BUSAN-LIVE-CONTRACT-01: 한 원천 실패는 다른 ready 결과를 지우지 않고 전체 상태만 partial로 만든다', () => {
  const partial = fixture.cases.partial;
  assert.equal(partial.status, 'partial');
  assert.equal(partial.sources.busan_food.status, 'unavailable');
  assert.equal(partial.sources.busan_attraction.status, 'ready');
  assert.equal(partial.sources.busan_shopping.status, 'ready');
  assert.deepEqual(partial.sources.busan_attraction.activeApprovedSourceIds, ['A-101']);
});

test('API-BUSAN-LIVE-CONTRACT-01: 세 원천 모두 실패할 때만 전체 unavailable이며 안전 enum만 반환한다', () => {
  const unavailable = fixture.cases.unavailable;
  assert.equal(unavailable.status, 'unavailable');
  for (const source of sourceNames) {
    assert.equal(unavailable.sources[source].status, 'unavailable');
    assert.match(unavailable.sources[source].reason, /^(timeout|network|http_error|provider_error|unauthorized|rate_limited|invalid_response|page_limit|request_budget_exhausted)$/);
  }
  assert.doesNotMatch(JSON.stringify(unavailable), /raw|query|coordinate|message|serviceKey|userId/i);
});

test('API-BUSAN-LIVE-CONTRACT-01: 사진은 승인 근거 없이 URL을 반환하지 않는다', () => {
  for (const source of sourceNames) {
    for (const record of fixture.cases.ready.sources[source].records) {
      assert.deepEqual(record.photo, { status: 'not_returned_without_approved_evidence' });
      assert.equal('url' in record.photo, false);
    }
  }
});
