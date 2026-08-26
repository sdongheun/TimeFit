import type { PlaceSearchProvider, PlaceSearchResult } from '../engine/kakao';
import type { Poi } from '../engine/travel';
import { matchPlaceNameQuery, planTransitPlaceQuery, type PlaceNameMatchKind } from './placeNameSemanticMatch';

export type PlaceSuggestionMatch = PlaceNameMatchKind | 'base_transit_place';
export type PlaceSearchSuggestion = { poi: Poi; match: PlaceSuggestionMatch; label: string; labelSource: 'provider_name' };
export type PlaceSuggestionDiagnostics = { providerCalls: Record<PlaceSearchProvider, number>; fallbackCalls: Record<PlaceSearchProvider, number> };
export type ProviderPlaceSearcher = (query: string) => Promise<PlaceSearchResult>;

function isTransitPlace(poi: Poi): boolean { return poi.providerMetadata?.placeType === 'transit_place'; }
function sameLines(queryLines: readonly string[], lines: readonly string[] | undefined): boolean {
  return queryLines.length === 0 || !!lines?.some((line) => queryLines.includes(line));
}

export async function searchPlaceSuggestions(input: { query: string; searchers: Record<PlaceSearchProvider, ProviderPlaceSearcher> }): Promise<{ suggestions: PlaceSearchSuggestion[]; results: PlaceSearchResult[]; diagnostics: PlaceSuggestionDiagnostics }> {
  const plan = planTransitPlaceQuery(input.query);
  const diagnostics: PlaceSuggestionDiagnostics = { providerCalls: { kakao: 0, tmap: 0 }, fallbackCalls: { kakao: 0, tmap: 0 } };
  const results: PlaceSearchResult[] = [];
  const suggestions: PlaceSearchSuggestion[] = [];
  for (const provider of ['kakao', 'tmap'] as const) {
    const first = await input.searchers[provider](input.query); diagnostics.providerCalls[provider] += 1; results.push(first);
    let candidates = first.pois;
    let direct = candidates.filter((poi) => matchPlaceNameQuery(input.query, poi.name) !== 'none' && sameLines(plan.transitTokens, poi.providerMetadata?.lineLabels));
    if (first.status === 'ok' && direct.length === 0 && plan.canFallback) {
      const fallback = await input.searchers[provider](plan.baseName); diagnostics.providerCalls[provider] += 1; diagnostics.fallbackCalls[provider] += 1; results.push(fallback);
      candidates = fallback.pois;
      direct = candidates.filter((poi) => isTransitPlace(poi) && matchPlaceNameQuery(plan.baseName, poi.name) !== 'none' && sameLines(plan.transitTokens, poi.providerMetadata?.lineLabels));
      suggestions.push(...direct.map((poi) => ({ poi, match: 'base_transit_place' as const, label: poi.name, labelSource: 'provider_name' as const })));
    } else {
      suggestions.push(...direct.map((poi) => ({ poi, match: matchPlaceNameQuery(input.query, poi.name), label: poi.name, labelSource: 'provider_name' as const })));
    }
  }
  const seen = new Set<string>();
  return { suggestions: suggestions.filter((item) => { const key = `${item.poi.name}|${item.poi.lat}|${item.poi.lon}`; if (seen.has(key)) return false; seen.add(key); return true; }), results, diagnostics };
}
