import type { Poi } from '../engine';
import { matchPlaceNameQuery } from '../services/placeNameSemanticMatch';
import type { PlaceSearchSuggestion } from '../services/placeSearchSuggestionAdapter';

const SHOP_WORDS = /맛집|식당|카페|커피|국밥|치킨|마트|편의점|미용|학원/;
const ADDRESS_LIKE_NAME = /(?:대로|로|길)\d/;

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
}

export type PlaceSearchRankingCounts = { input: number; exact: number; prefix: number; contains: number; transitVariant: number; baseTransitPlace?: number; addressLikeExcluded: number; shopExcluded: number; final: number };
export type PlaceSearchRankingDiagnostic = { results: Poi[]; counts: PlaceSearchRankingCounts };
export type PlaceSearchSuggestionRankingDiagnostic = { results: PlaceSearchSuggestion[]; counts: PlaceSearchRankingCounts };

function relevance(query: string, place: Poi, suppliedMatch?: PlaceSearchSuggestion['match']): { score: number; match: 'exact' | 'prefix' | 'contains' | 'transitVariant' | 'baseTransitPlace' | null; excluded: 'address' | 'shop' | null } {
  const q = normalized(query);
  const name = normalized(place.name);
  if (!q) return { score: 0, match: null, excluded: null };
  const semanticMatch = matchPlaceNameQuery(query, place.name);
  // 정확 일치는 제외 규칙보다 먼저 보존한다.
  if (name === q) return { score: 1_200, match: 'exact', excluded: null };
  // 일부 제공사는 주소 지오코딩 결과를 name 필드에도 넣는다. 장소명 선택기에서는 도로명+번지 형식을 막는다.
  if (ADDRESS_LIKE_NAME.test(name)) return { score: 0, match: null, excluded: 'address' };
  if (SHOP_WORDS.test(place.name)) return { score: 0, match: null, excluded: 'shop' };
  if (semanticMatch === 'direct' && name.startsWith(q)) return { score: 850, match: 'prefix', excluded: null };
  if (semanticMatch === 'direct' && name.includes(q)) return { score: 550, match: 'contains', excluded: null };
  if (semanticMatch === 'transit_variant') return { score: 500, match: 'transitVariant', excluded: null };
  // base fallback은 adapter가 교통 유형·base 이름·노선 metadata를 모두 확인해 전달한 경우에만 소비한다.
  if (suppliedMatch === 'base_transit_place') return { score: 450, match: 'baseTransitPlace', excluded: null };
  return { score: 0, match: null, excluded: null };
}

function countRelevance(counts: PlaceSearchRankingCounts, item: ReturnType<typeof relevance>) {
  if (item.match === 'baseTransitPlace') counts.baseTransitPlace = (counts.baseTransitPlace ?? 0) + 1;
  else if (item.match) counts[item.match] += 1;
  if (item.excluded === 'address') counts.addressLikeExcluded += 1;
  if (item.excluded === 'shop') counts.shopExcluded += 1;
}

/** 장소명에 검색어가 실제로 포함된 POI만 남긴다. 주소 일치·무관 상호는 장소명 선택기에 들어오지 않는다. */
export function diagnosePlaceSearchResults(query: string, candidates: readonly Poi[]): PlaceSearchRankingDiagnostic {
  const counts: PlaceSearchRankingCounts = { input: candidates.length, exact: 0, prefix: 0, contains: 0, transitVariant: 0, addressLikeExcluded: 0, shopExcluded: 0, final: 0 };
  const results = candidates
    .map((place, index) => ({ place, index, ...relevance(query, place) }))
    .map((item) => {
      countRelevance(counts, item);
      return item;
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ place }) => place);
  counts.final = results.length;
  return { results, counts };
}

/** API-S-4 adapter가 증명한 제안만 관련성 순으로 표시한다. UI는 base fallback이나 노선 정보를 추측하지 않는다. */
export function diagnosePlaceSearchSuggestions(query: string, candidates: readonly PlaceSearchSuggestion[]): PlaceSearchSuggestionRankingDiagnostic {
  const counts: PlaceSearchRankingCounts = { input: candidates.length, exact: 0, prefix: 0, contains: 0, transitVariant: 0, addressLikeExcluded: 0, shopExcluded: 0, final: 0 };
  const results = candidates
    .map((suggestion, index) => ({ suggestion, index, ...relevance(query, suggestion.poi, suggestion.match) }))
    .map((item) => { countRelevance(counts, item); return item; })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ suggestion }) => suggestion);
  counts.final = results.length;
  return { results, counts };
}

export function rankPlaceSearchResults(query: string, candidates: readonly Poi[]): Poi[] {
  return diagnosePlaceSearchResults(query, candidates).results;
}

/** 검색 결과는 사용자가 행을 고르기 전에는 위치 확정 대상이 아니다. */
export const initialPlaceSearchSelection = -1;
