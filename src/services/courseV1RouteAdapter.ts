import type { CourseV1Point, CourseV1RouteAdapter, CourseV1TravelMode, ExactRoute } from '../engine/courseV1';
import { precompute, precomputeTransit, travelMin, travelSrc } from '../engine/travel';

/** 기존 경로 모듈의 API/캐시 결과를 읽기 위한 좁은 경계다. */
export type CourseV1RouteFetcher = {
  fetch(from: CourseV1Point, to: CourseV1Point, mode: CourseV1TravelMode): Promise<{ min: number; source: string } | null>;
};

export const COURSE_V1_ROUTE_SUCCESS_TTL_MS = 24 * 60 * 60 * 1000;
export const COURSE_V1_ROUTE_FAILURE_TTL_MS = 5 * 60 * 1000;
export const COURSE_V1_AUTO_WALK_LIMIT_MIN = 14;

type CachedRoute = {
  value: ExactRoute | null;
  cachedAt: number;
};

export type CourseV1RouteDiagnostics = {
  fetchRequests: number;
  cacheHits: number;
  sharedInFlightWaits: number;
  failures: number;
};

export type CourseV1RouteAdapterWithDiagnostics = CourseV1RouteAdapter & {
  diagnostics(): CourseV1RouteDiagnostics;
};

export type CourseV1RouteCacheOwner = {
  createAdapter(): CourseV1RouteAdapterWithDiagnostics;
  diagnostics(): CourseV1RouteDiagnostics;
};

export type CourseV1RouteAdapterOptions = {
  fetcher?: CourseV1RouteFetcher;
  now?: () => number;
  successTtlMs?: number;
  failureTtlMs?: number;
  autoWalkLimitMin?: number;
};

/**
 * Course v1은 TMAP 보행과 ODsay 대중교통의 실제 응답만 쓴다.
 * travel.ts가 보관하는 haversine/transit_fallback/walk_short 값은 이 경계에서 null이다.
 */
export const defaultCourseV1RouteFetcher: CourseV1RouteFetcher = {
  async fetch(from, to, mode) {
    const pair: [{ lat: number; lon: number }, { lat: number; lon: number }] = [from, to];
    if (mode === 'walk') await precompute([pair], 'walk', { retryFallback: true });
    else await precomputeTransit([pair], { retryFallback: true });
    return { min: travelMin(from, to, mode), source: travelSrc(from, to, mode) };
  },
};

/**
 * 명시적 owner는 테스트·독립 작업 단위용이고, 옵션 없는 기본 생성은 앱 실행 중
 * 하나의 owner를 재사용한다. 어느 쪽도 위치를 영속 저장하지 않는다.
 */
export function createCourseV1RouteCacheOwner(options: CourseV1RouteAdapterOptions = {}): CourseV1RouteCacheOwner {
  const fetcher = options.fetcher ?? defaultCourseV1RouteFetcher;
  const now = options.now ?? Date.now;
  const successTtlMs = options.successTtlMs ?? COURSE_V1_ROUTE_SUCCESS_TTL_MS;
  const failureTtlMs = options.failureTtlMs ?? COURSE_V1_ROUTE_FAILURE_TTL_MS;
  const autoWalkLimitMin = options.autoWalkLimitMin ?? COURSE_V1_AUTO_WALK_LIMIT_MIN;
  const cache = new Map<string, CachedRoute>();
  const inFlight = new Map<string, Promise<ExactRoute | null>>();
  const counters: CourseV1RouteDiagnostics = { fetchRequests: 0, cacheHits: 0, sharedInFlightWaits: 0, failures: 0 };

  async function getExactRoute(from: CourseV1Point, to: CourseV1Point, mode: CourseV1TravelMode): Promise<ExactRoute | null> {
    const key = courseV1RouteCacheKey(mode, from, to);
    const cached = cache.get(key);
    if (cached && now() - cached.cachedAt < (cached.value ? successTtlMs : failureTtlMs)) {
      counters.cacheHits += 1;
      return cached.value;
    }
    if (cached) cache.delete(key);
    const existing = inFlight.get(key);
    if (existing) {
      counters.sharedInFlightWaits += 1;
      return existing;
    }

    const pending = (async () => {
      let response: { min: number; source: string } | null = null;
      try {
        counters.fetchRequests += 1;
        response = await fetcher.fetch(from, to, mode);
      } catch {
        // 네트워크·SDK 오류도 근사치로 바꾸지 않는다.
      }
      const value: ExactRoute | null = isExactResponse(mode, response) ? { mode, min: response.min, exact: true } : null;
      if (!value) counters.failures += 1;
      cache.set(key, { value, cachedAt: now() });
      return value;
    })().finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
    return pending;
  }

  function createAdapter(): CourseV1RouteAdapterWithDiagnostics {
    return {
      async getRoute(from, to) {
        const walk = await getExactRoute(from, to, 'walk');
        if (walk && walk.min <= autoWalkLimitMin) return walk;

        // 먼 구간 또는 도보 실패는 실제 ODsay 결과가 있어야만 대중교통으로 전환한다.
        return getExactRoute(from, to, 'transit');
      },
      diagnostics: () => ({ ...counters }),
    };
  }

  return { createAdapter, diagnostics: () => ({ ...counters }) };
}

let appSessionRouteAdapter: CourseV1RouteAdapterWithDiagnostics | undefined;

/** 앱 실행 중 추천 요청들이 공유하는 메모리 전용 경로 cache owner. */
export function getAppSessionCourseV1RouteAdapter(): CourseV1RouteAdapterWithDiagnostics {
  if (!appSessionRouteAdapter) appSessionRouteAdapter = createCourseV1RouteCacheOwner().createAdapter();
  return appSessionRouteAdapter;
}

export function createCourseV1RouteAdapter(options: CourseV1RouteAdapterOptions = {}): CourseV1RouteAdapterWithDiagnostics {
  return Object.keys(options).length === 0
    ? getAppSessionCourseV1RouteAdapter()
    : createCourseV1RouteCacheOwner(options).createAdapter();
}

export function courseV1RouteCacheKey(mode: CourseV1TravelMode, from: CourseV1Point, to: CourseV1Point): string {
  return `course-v1:exact-route:v1:${mode}:${pointKey(from)}:${pointKey(to)}`;
}

function pointKey(point: Pick<CourseV1Point, 'lat' | 'lon'>): string {
  return `${point.lat.toFixed(5)},${point.lon.toFixed(5)}`;
}

function isExactResponse(
  mode: CourseV1TravelMode,
  response: { min: number; source: string } | null,
): response is { min: number; source: string } {
  if (!response || !Number.isInteger(response.min) || response.min <= 0) return false;
  return mode === 'walk' ? response.source === 'TMAP' : response.source === 'ODsay';
}
