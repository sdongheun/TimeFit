import type { PlaceSearchResult, PlaceSearchStatus } from '../engine/kakao';
import type { PlaceSearchRankingCounts } from './placeSearchRanking';

export type PlaceSearchDisplayState = 'results' | 'empty' | 'retry';

/** 성공한 제공사의 이름 목록이 비었을 때만 빈 결과를 쓴다. 실패는 비밀정보 없이 재시도 상태로 분리한다. */
export function placeSearchDisplayState({ kakao, tmap, resultCount }: { kakao: PlaceSearchStatus; tmap: PlaceSearchStatus | null; resultCount: number }): PlaceSearchDisplayState {
  if (resultCount > 0) return 'results';
  return kakao === 'ok' && (tmap === null || tmap === 'ok') ? 'empty' : 'retry';
}

/** 원문 및 base fallback을 포함한 모든 provider 요청이 성공한 경우에만 빈 상태를 쓴다. */
export function placeSearchDisplayStateFromResults(results: readonly PlaceSearchResult[], resultCount: number): PlaceSearchDisplayState {
  if (resultCount > 0) return 'results';
  return results.length > 0 && results.every((result) => result.status === 'ok') ? 'empty' : 'retry';
}

/** 개발 완료 진단 전용: 원문 장소 데이터·검색어·좌표·키는 절대 포함하지 않는다. */
export function placeSearchCompletionDiagnostic({
  kakao,
  tmap,
  rankingCounts,
  staleIgnored,
  fallbackCalls,
  rawPoiCount,
}: {
  kakao: PlaceSearchResult;
  tmap: PlaceSearchResult | null;
  rankingCounts: PlaceSearchRankingCounts;
  staleIgnored: boolean;
  fallbackCalls?: { kakao: number; tmap: number };
  rawPoiCount?: number;
}) {
  return {
    providers: { kakao: kakao.status, tmap: tmap?.status ?? null },
    rawPoiCount: rawPoiCount ?? kakao.pois.length + (tmap?.pois.length ?? 0),
    matches: {
      exact: rankingCounts.exact,
      prefix: rankingCounts.prefix,
      contains: rankingCounts.contains,
      transitVariant: rankingCounts.transitVariant,
      ...(rankingCounts.baseTransitPlace ? { baseTransitPlace: rankingCounts.baseTransitPlace } : {}),
    },
    excluded: {
      addressLike: rankingCounts.addressLikeExcluded,
      shop: rankingCounts.shopExcluded,
    },
    finalCount: rankingCounts.final,
    staleIgnored,
    ...(fallbackCalls ? { fallbackCalls } : {}),
  };
}
