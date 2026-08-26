import assert from 'node:assert/strict';
import test from 'node:test';
import type { Poi } from '../../src/engine';
import type { PlaceSearchSuggestion } from '../../src/services/placeSearchSuggestionAdapter';
import { diagnosePlaceSearchResults, diagnosePlaceSearchSuggestions, initialPlaceSearchSelection, rankPlaceSearchResults } from '../../src/ui/placeSearchRanking';
import { placeSearchCompletionDiagnostic, placeSearchDisplayState } from '../../src/ui/placeSearchStateModel';
import { placeSuggestionLineLabel } from '../../src/ui/placeSearchSuggestionModel';

const poi = (name: string, addr: string): Poi => ({ name, addr, lat: 35.16, lon: 128.98 });
const suggestion = (name: string, match: PlaceSearchSuggestion['match'], lineLabels?: string[]): PlaceSearchSuggestion => ({
  poi: { ...poi(name, '부산'), ...(lineLabels ? { providerMetadata: { placeType: 'transit_place', lineLabels, labelSource: 'provider' as const } } : {}) },
  match,
  label: name,
  labelSource: 'provider_name',
});

test('사상역은 역·출구 이름만 보이고 동명 음식점·주소 행은 제외한다', () => {
  const ranked = rankPlaceSearchResults('사상역', [
    poi('사상역 맛집 국밥', '부산 사상구 광장로 1'),
    poi('사상역', '부산 사상구 사상로 201'),
    poi('사상역 2번 출구', '부산 사상구 광장로 83'),
    poi('부산광역시 사상구 사상역로 1', '부산광역시 사상구 사상역로 1'),
  ]);
  assert.deepEqual(ranked.map((item) => item.name), ['사상역', '사상역 2번 출구']);
});

test('주소만 일치하는 결과와 검색어를 포함하지 않는 상호는 장소명 목록에 넣지 않는다', () => {
  assert.deepEqual(rankPlaceSearchResults('부산진구 중앙대로 672', [poi('중앙대로 672 카페', '부산진구 중앙대로 670'), poi('부산광역시 부산진구 중앙대로 672', '부산광역시 부산진구 중앙대로 672')]), []);
  assert.deepEqual(rankPlaceSearchResults('사상역', [poi('무관한 카페', '부산 사상구 사상역로 1')]), []);
});

test('사·사상·사상역, TMAP fallback·빈 결과에서도 결과를 추정하거나 자동 선택하지 않는다', () => {
  assert.deepEqual(rankPlaceSearchResults('사', [poi('사상역', '부산 사상구 사상로 201'), poi('부산역', '부산 동구 중앙대로 206')]).map((item) => item.name), ['사상역']);
  assert.deepEqual(rankPlaceSearchResults('사상', [poi('사상구청', '부산 사상구 학감대로 242'), poi('사상역 맛집', '부산 사상구 광장로 1')]).map((item) => item.name), ['사상구청']);
  const tmapFallback = rankPlaceSearchResults('사상역', [poi('사상역', '부산 사상구 사상로 201')]);
  assert.equal(tmapFallback[0].name, '사상역');
  assert.deepEqual(rankPlaceSearchResults('없는 곳', []), []);
  assert.equal(initialPlaceSearchSelection, -1);
});

test('Kakao 성공 5개 fixture는 정확·역 관련 이름을 남기고 주소·상호 제외 개수만 진단한다', () => {
  const diagnostic = diagnosePlaceSearchResults('사상역', [
    poi('사상역', '부산 사상구'),
    poi('사상역 부산2호선', '부산 사상구'),
    poi('사상역 2번 출구', '부산 사상구'),
    poi('사상역 맛집', '부산 사상구'),
    poi('사상역로 1', '부산 사상구'),
  ]);
  assert.deepEqual(diagnostic.results.map((item) => item.name), ['사상역', '사상역 부산2호선', '사상역 2번 출구']);
  assert.deepEqual(diagnostic.counts, { input: 5, exact: 1, prefix: 2, contains: 0, transitVariant: 0, addressLikeExcluded: 1, shopExcluded: 1, final: 3 });
});

test('교통 수식어 표기 변형은 직접 이름 일치 다음으로 보이며 수식어 단독은 넓히지 않는다', () => {
  const ranked = diagnosePlaceSearchResults('사상역 2호선', [
    poi('사상역 부산2호선', '부산 사상구'),
    poi('사상역 2호선', '부산 사상구'),
    poi('부산2호선 사상역', '부산 사상구'),
    poi('사상역로 1', '부산 사상구'),
    poi('무관한 카페', '부산 사상구'),
  ]);
  assert.deepEqual(ranked.results.map((item) => item.name), ['사상역 2호선', '사상역 부산2호선', '부산2호선 사상역']);
  assert.deepEqual(ranked.counts, { input: 5, exact: 1, prefix: 0, contains: 0, transitVariant: 2, addressLikeExcluded: 1, shopExcluded: 1, final: 3 });
  assert.deepEqual(rankPlaceSearchResults('2호선', [poi('사상역 부산2호선', '부산 사상구')]), []);
});

test('구조화 base 역 fallback은 제공사 근거가 있을 때만 보조 제안으로 남기고 노선 라벨을 합성하지 않는다', () => {
  const ranked = diagnosePlaceSearchSuggestions('사상역 2호선', [
    suggestion('사상역 부산2호선', 'transit_variant', ['2호선']),
    suggestion('사상역', 'base_transit_place', ['2호선']),
    suggestion('사상역 맛집', 'direct'),
    suggestion('사상역로 1', 'direct'),
  ]);
  assert.deepEqual(ranked.results.map((item) => [item.label, item.match]), [['사상역 부산2호선', 'transit_variant'], ['사상역', 'base_transit_place']]);
  assert.equal(placeSuggestionLineLabel(ranked.results[0]!), '2호선');
  assert.equal(placeSuggestionLineLabel(suggestion('사상역', 'base_transit_place')), null);
  assert.deepEqual(ranked.counts, { input: 4, exact: 0, prefix: 0, contains: 0, transitVariant: 1, baseTransitPlace: 1, addressLikeExcluded: 1, shopExcluded: 1, final: 2 });
});

test('성공 필터 0개와 제공사 실패는 서로 다른 화면 상태다', () => {
  assert.equal(placeSearchDisplayState({ kakao: 'ok', tmap: 'ok', resultCount: 0 }), 'empty');
  assert.equal(placeSearchDisplayState({ kakao: 'ok', tmap: 'http_error', resultCount: 0 }), 'retry');
  assert.equal(placeSearchDisplayState({ kakao: 'ok', tmap: 'network_error', resultCount: 1 }), 'results');
});

test('완료 진단은 제공사 상태와 개수만 보존하며 stale 응답 여부를 구분한다', () => {
  const diagnostic = placeSearchCompletionDiagnostic({
    kakao: { provider: 'kakao', status: 'ok', pois: [poi('가', 'x'), poi('나', 'y')] },
    tmap: { provider: 'tmap', status: 'ok', pois: [poi('다', 'z')] },
    rankingCounts: { input: 3, exact: 1, prefix: 0, contains: 0, transitVariant: 0, addressLikeExcluded: 1, shopExcluded: 1, final: 1 },
    staleIgnored: true,
    fallbackCalls: { kakao: 1, tmap: 0 },
    rawPoiCount: 4,
  });
  assert.deepEqual(diagnostic, {
    providers: { kakao: 'ok', tmap: 'ok' },
    rawPoiCount: 4,
    matches: { exact: 1, prefix: 0, contains: 0, transitVariant: 0 },
    excluded: { addressLike: 1, shop: 1 },
    finalCount: 1,
    staleIgnored: true,
    fallbackCalls: { kakao: 1, tmap: 0 },
  });
});
