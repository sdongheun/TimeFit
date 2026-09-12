import type { CourseV1Point, CourseV1RouteAdapter, CourseV1TravelMode, ExactRoute } from '../engine/courseV1';
import { precompute, travelMin, travelSrc } from '../engine/travel';

/** 기존 경로 모듈의 API/캐시 결과를 읽기 위한 좁은 경계다. */
export type CourseV1RouteFetcher = {
  /** true이면 실제 legacy transport가 HTTP 직전마다 observer를 호출한다. */
  providerHttpAttemptsObserved?: boolean;
  fetch(
    from: CourseV1Point,
    to: CourseV1Point,
    mode: CourseV1TravelMode,
    transport: CourseV1RouteTransportObserver,
  ): Promise<{ min: number; source: string } | null>;
};

export type CourseV1RouteProvider = 'tmap';

/**
 * legacy transport가 실제 HTTP 요청 직전에 호출하는 좁은 관찰·예산 경계다.
 * 기존 direct fetcher는 이 hook을 사용하지 않으므로 HTTP attempt 수를 추정하지 않는다.
 */
export type CourseV1RouteTransportObserver = {
  /** Retired provider input is accepted only to deny old callers, never as a live budget. */
  recordProviderHttpAttempt(provider: CourseV1RouteProvider | 'odsay'): boolean;
};

/** 한 추천 요청에만 적용하는 선택적 호출 상한이다. 값이 없으면 그 종류의 상한도 없다. */
export type RouteRequestBudget = {
  logicalSegments?: number;
  walkFetches?: number;
  transitFetches?: number;
  providerHttpAttempts?: Partial<Record<CourseV1RouteProvider, number>>;
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
  logicalSegments: number;
  adapterFetches: Record<CourseV1TravelMode, number>;
  providerHttpAttempts: Record<CourseV1RouteProvider, number>;
  /** transport hook을 호출한 fixture/client가 있을 때만 true다. */
  providerHttpAttemptsObserved: boolean;
  limited: {
    logicalSegments: number;
    walkFetches: number;
    transitFetches: number;
    providerHttpAttempts: number;
  };
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

export type CourseV1RouteRequestScopeOptions = CourseV1RouteAdapterOptions & {
  budget: RouteRequestBudget;
};

/**
 * Legacy adapter는 TMAP 보행만 쓴다. 출시 대중교통은 별도 Kakao proxy 소유다.
 * travel.ts가 보관하는 haversine/transit_fallback/walk_short 값은 이 경계에서 null이다.
 */
export const defaultCourseV1RouteFetcher: CourseV1RouteFetcher = {
  providerHttpAttemptsObserved: true,
  async fetch(from, to, mode, transport) {
    if (mode !== 'walk') return null;
    const pair: [{ lat: number; lon: number }, { lat: number; lon: number }] = [from, to];
    await precompute([pair], 'walk', { retryFallback: true, transportObserver: transport });
    return { min: travelMin(from, to, mode), source: travelSrc(from, to, mode) };
  },
};

/**
 * 명시적 owner는 테스트·독립 작업 단위용이고, 옵션 없는 기본 생성은 앱 실행 중
 * 하나의 owner를 재사용한다. 어느 쪽도 위치를 영속 저장하지 않는다.
 */
export function createCourseV1RouteCacheOwner(
  options: CourseV1RouteAdapterOptions = {},
  budget?: RouteRequestBudget,
): CourseV1RouteCacheOwner {
  const fetcher = options.fetcher ?? defaultCourseV1RouteFetcher;
  const now = options.now ?? Date.now;
  const successTtlMs = options.successTtlMs ?? COURSE_V1_ROUTE_SUCCESS_TTL_MS;
  const failureTtlMs = options.failureTtlMs ?? COURSE_V1_ROUTE_FAILURE_TTL_MS;
  const autoWalkLimitMin = options.autoWalkLimitMin ?? COURSE_V1_AUTO_WALK_LIMIT_MIN;
  const cache = new Map<string, CachedRoute>();
  const inFlight = new Map<string, Promise<RouteLookup>>();
  const counters: CourseV1RouteDiagnostics = {
    fetchRequests: 0,
    cacheHits: 0,
    sharedInFlightWaits: 0,
    failures: 0,
    logicalSegments: 0,
    adapterFetches: { walk: 0, transit: 0 },
    providerHttpAttempts: { tmap: 0 },
    providerHttpAttemptsObserved: false,
    limited: { logicalSegments: 0, walkFetches: 0, transitFetches: 0, providerHttpAttempts: 0 },
  };

  function diagnostics(): CourseV1RouteDiagnostics {
    return {
      ...counters,
      adapterFetches: { ...counters.adapterFetches },
      providerHttpAttempts: { ...counters.providerHttpAttempts },
      limited: { ...counters.limited },
    };
  }

  function recordProviderHttpAttempt(provider: CourseV1RouteProvider | 'odsay'): boolean {
    if (provider !== 'tmap') return false;
    counters.providerHttpAttemptsObserved = true;
    const limit = budget?.providerHttpAttempts?.[provider];
    if (limit !== undefined && counters.providerHttpAttempts[provider] >= limit) {
      counters.limited.providerHttpAttempts += 1;
      return false;
    }
    counters.providerHttpAttempts[provider] += 1;
    return true;
  }

  async function getExactRoute(from: CourseV1Point, to: CourseV1Point, mode: CourseV1TravelMode): Promise<RouteLookup> {
    const key = courseV1RouteCacheKey(mode, from, to);
    const cached = cache.get(key);
    if (cached && now() - cached.cachedAt < (cached.value ? successTtlMs : failureTtlMs)) {
      counters.cacheHits += 1;
      return { value: cached.value, limited: false };
    }
    if (cached) cache.delete(key);
    const existing = inFlight.get(key);
    if (existing) {
      counters.sharedInFlightWaits += 1;
      return existing;
    }

    const pending = (async () => {
      let response: { min: number; source: string } | null = null;
      let limited = false;
      try {
        if (hasProviderHttpBudget(budget) && fetcher.providerHttpAttemptsObserved !== true) {
          counters.limited.providerHttpAttempts += 1;
          return { value: null, limited: true };
        }
        const fetchLimit = mode === 'walk' ? budget?.walkFetches : budget?.transitFetches;
        if (fetchLimit !== undefined && counters.adapterFetches[mode] >= fetchLimit) {
          counters.limited[mode === 'walk' ? 'walkFetches' : 'transitFetches'] += 1;
          return { value: null, limited: true };
        }
        counters.fetchRequests += 1;
        counters.adapterFetches[mode] += 1;
        let providerAttemptLimited = false;
        response = await fetcher.fetch(from, to, mode, {
          recordProviderHttpAttempt(provider) {
            const accepted = recordProviderHttpAttempt(provider);
            if (!accepted) providerAttemptLimited = true;
            return accepted;
          },
        });
        // transport가 거부 신호를 무시해도 제한된 결과를 exact route로 승격하지 않는다.
        if (providerAttemptLimited) {
          limited = true;
          response = null;
        }
      } catch {
        // 네트워크·SDK 오류도 근사치로 바꾸지 않는다.
      }
      const value: ExactRoute | null = isExactResponse(mode, response) ? { mode, min: response.min, exact: true } : null;
      if (!value) counters.failures += 1;
      // 예산 소진은 다음 scope의 실패 cache가 아니라 해당 새 구간의 limited 상태다.
      if (!limited) cache.set(key, { value, cachedAt: now() });
      return { value, limited };
    })().finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
    return pending;
  }

  function createAdapter(): CourseV1RouteAdapterWithDiagnostics {
    return {
      async getRoute(from, to) {
        counters.logicalSegments += 1;
        if (budget?.logicalSegments !== undefined && counters.logicalSegments > budget.logicalSegments) {
          counters.limited.logicalSegments += 1;
          return null;
        }
        const walk = await getExactRoute(from, to, 'walk');
        if (walk.limited) return null;
        if (walk.value && walk.value.min <= autoWalkLimitMin) return walk.value;

        // 과거 source snapshot을 신규 exact 성공/cache로 수입하지 않는다.
        // 이 legacy 경계에는 transit provider가 없으며 근사 성공도 만들지 않는다.
        return null;
      },
      diagnostics,
    };
  }

  return { createAdapter, diagnostics };
}

type RouteLookup = { value: ExactRoute | null; limited: boolean };

function hasProviderHttpBudget(budget: RouteRequestBudget | undefined): boolean {
  return budget?.providerHttpAttempts?.tmap !== undefined;
}

/**
 * 추천 1회 수명용 cache·in-flight·예산 scope다. UI 기본 adapter에는 연결하지 않는다.
 * cache hit/shared in-flight은 논리 구간으로만 기록되며 새 fetch/HTTP attempt를 소비하지 않는다.
 */
export function createCourseV1RouteRequestScope(options: CourseV1RouteRequestScopeOptions): CourseV1RouteCacheOwner {
  const { budget, ...adapterOptions } = options;
  return createCourseV1RouteCacheOwner(adapterOptions, budget);
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
  return mode === 'walk' && response.source === 'TMAP';
}
