import assert from 'node:assert/strict';
import test from 'node:test';
import type { KakaoLocationSearchResult, LocationSuggestion } from '../../src/services/kakaoLocationSearchAdapter';
import { applyLocationSearchResult, changeLocationQuery, confirmedLocationSuggestion, initialLocationSelectionState, selectLocationSuggestion, shouldDebounceLocationSearch } from '../../src/ui/locationSelectionModel';

const place: LocationSuggestion = { kind: 'place', provider: 'kakao', label: '사상역', lat: 35.162, lon: 128.985, address: '부산 사상구 광장로', labelSource: 'provider', addressSource: 'provider', providerLineLabels: ['2호선'] };
const address: LocationSuggestion = { kind: 'address', provider: 'kakao', label: '부산진구 중앙대로 672', lat: 35.157, lon: 129.059, address: '부산진구 중앙대로 672', labelSource: 'provider', addressSource: 'provider' };
const result = (suggestions: LocationSuggestion[], cache: 'miss' | 'hit' | 'shared_in_flight' = 'miss', fallbackCount = 0): KakaoLocationSearchResult => ({
  suggestions,
  attempts: [{ provider: 'kakao', status: 'ok' }],
  diagnostics: { providerRequests: { kakao: { place: 1, address: fallbackCount }, tmap: 0 }, fallbackCount, cache },
});

test('빈 입력은 선택/확정값이 없고 두 글자부터만 debounce 제안을 시작한다', () => {
  assert.equal(shouldDebounceLocationSearch('사'), false);
  assert.equal(shouldDebounceLocationSearch('사상'), true);
  assert.equal(confirmedLocationSuggestion(initialLocationSelectionState), null);
});

test('장소·주소 fixture와 adapter cache/fallback 진단은 그대로 소비하며 명시 선택 전에는 확정하지 않는다', () => {
  const query = changeLocationQuery(initialLocationSelectionState, '사상역');
  const places = applyLocationSearchResult(query, query.requestId, result([place], 'hit'));
  assert.equal(places.suggestions[0]?.kind, 'place');
  assert.equal(confirmedLocationSuggestion(places), null);
  assert.equal(confirmedLocationSuggestion(selectLocationSuggestion(places, 0))?.label, '사상역');

  const addressQuery = changeLocationQuery(places, '부산진구 중앙대로 672');
  const addresses = applyLocationSearchResult(addressQuery, addressQuery.requestId, result([address], 'miss', 1));
  assert.equal(addresses.suggestions[0]?.kind, 'address');
  assert.equal(addresses.suggestions[0]?.provider, 'kakao');
});

test('입력 변경 뒤 늦은 응답은 stale로 버리고 새 선택을 덮어쓰지 않는다', () => {
  const first = changeLocationQuery(initialLocationSelectionState, '사상역');
  const second = changeLocationQuery(first, '부산역');
  const ignored = applyLocationSearchResult(second, first.requestId, result([place], 'shared_in_flight'));
  assert.equal(ignored, second);
  assert.equal(confirmedLocationSuggestion(ignored), null);
});
