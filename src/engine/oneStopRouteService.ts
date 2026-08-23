import { precompute, precomputeTransit, travelMin, travelSrc } from './travel';
import type { LatLon } from './types';

export type OneStopRouteMode = 'walk' | 'transit';
export type OneStopRouteEstimate = {
  approachMin: number;
  onwardMin: number;
  exact: boolean;
};

export type OneStopRouteResult = {
  status: 'ready' | 'partial' | 'unavailable';
  modes: Record<OneStopRouteMode, OneStopRouteEstimate>;
};

export type OneStopRouteAdapter = {
  precomputeWalk(pairs: [LatLon, LatLon][], options?: { retryFallback?: boolean }): Promise<unknown>;
  precomputeTransit(pairs: [LatLon, LatLon][], options?: { retryFallback?: boolean }): Promise<unknown>;
  read(from: LatLon, to: LatLon, mode: OneStopRouteMode): { min: number; source: string };
};

export const defaultOneStopRouteAdapter: OneStopRouteAdapter = {
  precomputeWalk: (pairs, options) => precompute(pairs, 'walk', options),
  precomputeTransit: (pairs, options) => precomputeTransit(pairs, options),
  read: (from, to, mode) => ({ min: travelMin(from, to, mode), source: travelSrc(from, to, mode) }),
};

type RouteRequest = {
  origin: LatLon;
  target: LatLon;
  spot: { contentId: string; lat: number; lon: number };
  forceRefresh?: boolean;
};

const exactSource = (mode: OneStopRouteMode, source: string) => (
  mode === 'walk' ? source === 'TMAP' : source === 'ODsay' || source === 'walk_short'
);

export function createOneStopRouteService(options: { adapter?: OneStopRouteAdapter } = {}) {
  const adapter = options.adapter ?? defaultOneStopRouteAdapter;
  const completed = new Map<string, OneStopRouteResult>();
  const inFlight = new Map<string, Promise<OneStopRouteResult>>();

  async function get(request: RouteRequest): Promise<OneStopRouteResult> {
    const key = oneStopRouteKey(request.origin, request.spot, request.target);
    if (!request.forceRefresh) {
      const cached = completed.get(key);
      if (cached) return cached;
      const pending = inFlight.get(key);
      if (pending) return pending;
    }

    const pending = refine(request)
      .then((result) => {
        completed.set(key, result);
        return result;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
    return pending;
  }

  async function refine(request: RouteRequest): Promise<OneStopRouteResult> {
    const pairs: [LatLon, LatLon][] = [
      [request.origin, request.spot],
      [request.spot, request.target],
    ];
    const retryFallback = request.forceRefresh === true;
    await Promise.all([
      adapter.precomputeWalk(pairs, { retryFallback }),
      adapter.precomputeTransit(pairs, { retryFallback }),
    ]);

    const modes = Object.fromEntries((['walk', 'transit'] as const).map((mode) => {
      const approach = adapter.read(request.origin, request.spot, mode);
      const onward = adapter.read(request.spot, request.target, mode);
      return [mode, {
        approachMin: approach.min,
        onwardMin: onward.min,
        exact: exactSource(mode, approach.source) && exactSource(mode, onward.source),
      } satisfies OneStopRouteEstimate];
    })) as Record<OneStopRouteMode, OneStopRouteEstimate>;

    const readyCount = Object.values(modes).filter((item) => item.exact).length;
    return { modes, status: readyCount === 2 ? 'ready' : readyCount === 1 ? 'partial' : 'unavailable' };
  }

  return { get };
}

export function oneStopRouteKey(origin: LatLon, spot: { contentId: string; lat: number; lon: number }, target: LatLon): string {
  const point = (value: LatLon) => `${value.lat.toFixed(5)},${value.lon.toFixed(5)}`;
  return `one-stop:${point(origin)}:${spot.contentId}:${point(spot)}:${point(target)}`;
}
