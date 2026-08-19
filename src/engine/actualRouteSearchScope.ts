import type { LatLon, Mode, Strategy } from "./types";

export const DEFAULT_ROUTE_SEARCH_RADIUS_M = 1_000;
export const MAX_ROUTE_SEARCH_RADIUS_M = 8_000;

export type RouteBaseline = {
  mode: Mode;
  /**
   * TMAP은 실제 도로/보행 경로, ODsay는 승하차·경유 정류장/역 연결선이다.
   * 이 모듈은 경로의 출처를 해석하지 않고, 유효한 geometry만 공간 탐색에 사용한다.
   */
  geometry: readonly LatLon[];
};

export type ActualRouteSearchScope =
  | {
    kind: "return_area";
    origin: LatLon;
    radiusM: number;
  }
  | {
    kind: "route_corridor";
    origin: LatLon;
    destination: LatLon;
    radiusM: number;
    routes: ReadonlyArray<RouteBaseline>;
  }
  | {
    kind: "endpoint_fallback";
    origin: LatLon;
    destination: LatLon;
    radiusM: number;
  };

/**
 * 실제 기준 경로가 없을 때는 사용자가 확장한 반경을 적용하지 않는다.
 * 경로 축을 알 수 없는 상태에서 8km 원을 만들면 철회한 넓은 반경 정책으로 되돌아가기 때문이다.
 */
export function createActualRouteSearchScope(input: {
  origin: LatLon;
  destination?: LatLon | null;
  radiusM?: number;
  baselines?: readonly RouteBaseline[];
}): ActualRouteSearchScope {
  const radiusM = normalizeRadius(input.radiusM);
  const destination = input.destination ?? null;

  if (!destination) return { kind: "return_area", origin: input.origin, radiusM };

  const routes = (input.baselines ?? [])
    .filter((baseline) => isValidRoute(baseline.geometry))
    .map((baseline) => ({
      ...baseline,
      geometry: withEndpoints(baseline.geometry, input.origin, destination),
    }));

  if (routes.length === 0) {
    return {
      kind: "endpoint_fallback",
      origin: input.origin,
      destination,
      radiusM: DEFAULT_ROUTE_SEARCH_RADIUS_M,
    };
  }

  return { kind: "route_corridor", origin: input.origin, destination, radiusM, routes };
}

export function isPointInActualRouteSearchScope(point: LatLon, scope: ActualRouteSearchScope): boolean {
  if (scope.kind === "return_area") return distanceMeters(point, scope.origin) <= scope.radiusM;
  if (scope.kind === "endpoint_fallback") {
    return distanceMeters(point, scope.origin) <= scope.radiusM
      || distanceMeters(point, scope.destination) <= scope.radiusM;
  }
  return scope.routes.some((route) => distanceToPolylineMeters(point, route.geometry) <= scope.radiusM);
}

// 전략 라벨은 후보를 제한하지 않는다. 지도·카드에서 후보가 어느 생활권에 가까운지 설명하는 용도다.
export function strategyForActualRoutePoint(point: LatLon, scope: ActualRouteSearchScope): Strategy {
  if (scope.kind === "return_area") return "origin_area";
  const originDistance = distanceMeters(point, scope.origin);
  const destinationDistance = distanceMeters(point, scope.destination);
  const endpointLabelRadius = Math.min(scope.radiusM, DEFAULT_ROUTE_SEARCH_RADIUS_M);
  if (originDistance <= endpointLabelRadius && originDistance <= destinationDistance) return "origin_area";
  if (destinationDistance <= endpointLabelRadius) return "destination_area";
  return "route_area";
}

export function distanceToPolylineMeters(point: LatLon, line: readonly LatLon[]): number {
  if (line.length === 0) return Number.POSITIVE_INFINITY;
  if (line.length === 1) return distanceMeters(point, line[0]);

  let min = Number.POSITIVE_INFINITY;
  for (let index = 1; index < line.length; index += 1) {
    min = Math.min(min, distanceToSegmentMeters(point, line[index - 1], line[index]));
  }
  return min;
}

function normalizeRadius(radiusM: number | undefined): number {
  if (!Number.isFinite(radiusM)) return DEFAULT_ROUTE_SEARCH_RADIUS_M;
  return Math.max(DEFAULT_ROUTE_SEARCH_RADIUS_M, Math.min(MAX_ROUTE_SEARCH_RADIUS_M, Math.round(radiusM as number)));
}

function isValidRoute(points: readonly LatLon[]): boolean {
  return points.length >= 2 && points.every(isValidPoint);
}

function isValidPoint(point: LatLon): boolean {
  return Number.isFinite(point.lat) && Number.isFinite(point.lon)
    && point.lat >= 32 && point.lat <= 39 && point.lon >= 124 && point.lon <= 132;
}

function withEndpoints(points: readonly LatLon[], origin: LatLon, destination: LatLon): LatLon[] {
  const normalized = [...points];
  if (!samePoint(normalized[0], origin)) normalized.unshift(origin);
  if (!samePoint(normalized[normalized.length - 1], destination)) normalized.push(destination);
  return normalized;
}

function samePoint(a: LatLon, b: LatLon): boolean {
  return Math.abs(a.lat - b.lat) < 0.000001 && Math.abs(a.lon - b.lon) < 0.000001;
}

function distanceToSegmentMeters(point: LatLon, a: LatLon, b: LatLon): number {
  const radians = Math.PI / 180;
  const metersPerLat = 6_371_000 * radians;
  const referenceLat = ((a.lat + b.lat + point.lat) / 3) * radians;
  const metersPerLon = metersPerLat * Math.cos(referenceLat);
  const ax = (a.lon - point.lon) * metersPerLon;
  const ay = (a.lat - point.lat) * metersPerLat;
  const bx = (b.lon - point.lon) * metersPerLon;
  const by = (b.lat - point.lat) * metersPerLat;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(ax, ay);
  const projection = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
  return Math.hypot(ax + projection * dx, ay + projection * dy);
}

function distanceMeters(a: LatLon, b: LatLon): number {
  const radians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * radians;
  const dLon = (b.lon - a.lon) * radians;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
