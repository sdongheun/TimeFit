import type { PlaceSearchSuggestion } from '../services/placeSearchSuggestionAdapter';

/** 제공사 metadata가 준 경우에만 노선 라벨을 보여 준다. */
export function placeSuggestionLineLabel(suggestion: PlaceSearchSuggestion): string | null {
  const labels = suggestion.poi.providerMetadata?.lineLabels;
  return labels?.length ? labels.join(' · ') : null;
}
