import type { KakaoLocationSearchResult, LocationSuggestion } from '../services/kakaoLocationSearchAdapter';

export type LocationSelectionState = {
  query: string;
  requestId: number;
  suggestions: LocationSuggestion[];
  selectedIndex: number;
  message: string;
};

export const initialLocationSelectionState: LocationSelectionState = {
  query: '',
  requestId: 0,
  suggestions: [],
  selectedIndex: -1,
  message: '장소 이름으로 검색하세요',
};

export function shouldDebounceLocationSearch(query: string): boolean {
  return query.trim().length >= 2;
}

/** 입력이 바뀌면 이전 응답과 선택값은 확정 payload에 다시 쓰이지 않는다. */
export function changeLocationQuery(state: LocationSelectionState, query: string): LocationSelectionState {
  return {
    query,
    requestId: state.requestId + 1,
    suggestions: [],
    selectedIndex: -1,
    message: query.trim() ? '검색 중...' : '장소 이름으로 검색하세요',
  };
}

/** requestId가 다르면 늦게 도착한 응답을 화면 상태에 적용하지 않는다. */
export function applyLocationSearchResult(state: LocationSelectionState, requestId: number, result: KakaoLocationSearchResult): LocationSelectionState {
  if (requestId !== state.requestId) return state;
  const allOk = result.attempts.every((attempt) => attempt.status === 'ok');
  return {
    ...state,
    suggestions: result.suggestions,
    selectedIndex: -1,
    message: result.suggestions.length
      ? '목록에서 위치를 선택하세요'
      : allOk ? '장소 또는 주소 결과가 없어요' : '위치 검색을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.',
  };
}

export function selectLocationSuggestion(state: LocationSelectionState, index: number): LocationSelectionState {
  return index >= 0 && index < state.suggestions.length ? { ...state, selectedIndex: index } : state;
}

export function confirmedLocationSuggestion(state: LocationSelectionState): LocationSuggestion | null {
  return state.selectedIndex >= 0 ? state.suggestions[state.selectedIndex] ?? null : null;
}
