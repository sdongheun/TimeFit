import { createActualRouteSearchScope, isPointInActualRouteSearchScope } from '../../engine/actualRouteSearchScope';
import type { LatLon } from '../../engine';
import type { RouteBaseline } from '../../engine/actualRouteSearchScope';

export const ONE_STOP_SEARCH_STEPS_M = [1_000, 2_000, 3_000, 5_000, 8_000] as const;
export const DEFAULT_ONE_STOP_SEARCH_RADIUS_M = ONE_STOP_SEARCH_STEPS_M[0];

export function filterOneStopCandidatesByRadius<T extends LatLon>(input: {
  spots: T[];
  origin: LatLon;
  destination: LatLon | null;
  baselines: readonly RouteBaseline[];
  radiusM: number;
}): T[] {
  const scope = createActualRouteSearchScope({
    origin: input.origin,
    destination: input.destination,
    baselines: input.baselines,
    radiusM: input.radiusM,
  });
  return input.spots.filter((spot) => isPointInActualRouteSearchScope(spot, scope));
}
