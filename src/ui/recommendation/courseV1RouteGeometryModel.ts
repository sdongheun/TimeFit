import {
  COURSE_V1_ROUTE_GEOMETRY_PATH_LIMIT,
  COURSE_V1_ROUTE_GEOMETRY_POINT_LIMIT,
  type CourseV1RouteGeometry,
  type CourseV1TravelMode,
  type VerifiedCourseV1,
} from '../../engine';
import type {
  PrivateWalkConnectorPoint,
  PrivateWalkConnectorPort,
} from '../../services/privateWalkConnector';
import type { RecommendationSession } from '../nav';
import type { RouteMapSegment } from '../map/routeSegments';

export const COURSE_V1_ROUTE_GEOMETRY_MISSING_MESSAGE = '일부 경로선을 표시하지 못했어요';

export type CourseV1RouteMapSegment = RouteMapSegment & Readonly<{
  mode: CourseV1TravelMode;
  legIndex: number;
  pathIndex: number;
  connectorKey?: CourseV1ConnectorKey;
}>;

export type CourseV1ConnectorKey = `${number}:${'start' | 'end'}`;
export type CourseV1ConnectorRequest = Readonly<{
  key: CourseV1ConnectorKey;
  legIndex: number;
  endpoint: 'start' | 'end';
  from: PrivateWalkConnectorPoint;
  to: PrivateWalkConnectorPoint;
}>;
export type CourseV1LoadedConnector = Readonly<{
  key: CourseV1ConnectorKey;
  geometry: CourseV1RouteGeometry;
}>;
export type CourseV1ConnectorLoadResult = Readonly<{
  connectors: readonly CourseV1LoadedConnector[];
  failedCount: number;
}>;

export type CourseV1RouteGeometryLegendItem = Readonly<{
  mode: CourseV1TravelMode;
  label: '도보 경로' | '대중교통 경로';
}>;

export type CourseV1RouteGeometryModel = Readonly<{
  segments: readonly CourseV1RouteMapSegment[];
  legend: readonly CourseV1RouteGeometryLegendItem[];
  accessibilityLabel: string;
  hasMissingGeometry: boolean;
  missingMessage?: typeof COURSE_V1_ROUTE_GEOMETRY_MISSING_MESSAGE;
}>;

/** 검증 snapshot을 화면 선으로만 투영한다. 손상된 leg는 직선으로 보정하지 않는다. */
export function buildCourseV1RouteGeometryModel(
  course: VerifiedCourseV1,
  connectors: readonly CourseV1LoadedConnector[] = [],
): CourseV1RouteGeometryModel {
  const segments: CourseV1RouteMapSegment[] = [];
  const legend: CourseV1RouteGeometryLegendItem[] = [];
  const seenModes = new Set<CourseV1TravelMode>();
  const connectorByKey = new Map(connectors.map((connector) => [connector.key, connector.geometry]));
  let hasMissingGeometry = false;

  const addGeometry = (
    geometry: CourseV1RouteGeometry | undefined,
    mode: CourseV1TravelMode,
    legIndex: number,
    connectorKey?: CourseV1ConnectorKey,
  ) => {
    if (!hasValidGeometry(geometry)) return false;
    geometry.paths.forEach((geometryPath, pathIndex) => {
      segments.push({
        points: geometryPath.points.map(({ lat, lon }) => ({ lat, lon })),
        quality: 'precise',
        mode,
        legIndex,
        pathIndex,
        ...(connectorKey ? { connectorKey } : {}),
      });
    });
    if (!seenModes.has(mode)) {
      seenModes.add(mode);
      legend.push({ mode, label: mode === 'walk' ? '도보 경로' : '대중교통 경로' });
    }
    return true;
  };

  course.legs.forEach((leg, legIndex) => {
    const startKey = `${legIndex}:start` as const;
    const endKey = `${legIndex}:end` as const;
    addGeometry(connectorByKey.get(startKey), 'walk', legIndex, startKey);
    if (!addGeometry(leg.geometry, leg.mode, legIndex)) {
      hasMissingGeometry = true;
      return;
    }
    addGeometry(connectorByKey.get(endKey), 'walk', legIndex, endKey);
  });

  return {
    segments,
    legend,
    accessibilityLabel: legend.length ? `경로 범례, ${legend.map(({ label }) => label).join(', ')}` : '',
    hasMissingGeometry,
    ...(hasMissingGeometry ? { missingMessage: COURSE_V1_ROUTE_GEOMETRY_MISSING_MESSAGE } : {}),
  };
}

type CourseV1ConnectorPlace = Readonly<{ lat: number; lon: number }>;
const CONNECTOR_GAP_METERS = 50;
const CONNECTOR_LIMIT = 6;
const CONNECTOR_CONCURRENCY = 2;

/** one/two-stop snapshot의 유효한 transit 선 끝과 기대 endpoint만 비교한다. */
export function buildCourseV1ConnectorRequests(
  course: VerifiedCourseV1,
  session: RecommendationSession,
  getPlace: (placeId: string) => CourseV1ConnectorPlace | undefined,
): CourseV1ConnectorRequest[] {
  if (course.placeIds.length < 1 || course.placeIds.length > 2
    || course.stops.length !== course.placeIds.length
    || course.legs.length !== course.placeIds.length + 1) return [];
  const places = course.placeIds.map(getPlace);
  const destination = session.destination ?? session.origin;
  if (!validPoint(session.origin) || places.some((place) => !validPoint(place)) || !validPoint(destination)) return [];
  if (course.stops.some((stop, index) => stop.placeId !== course.placeIds[index])) return [];
  const pointIds = [session.origin.id, ...course.placeIds, destination.id];
  if (course.legs.some((leg, index) => leg.fromId !== pointIds[index] || leg.toId !== pointIds[index + 1])) return [];

  const points = [session.origin, ...(places as CourseV1ConnectorPlace[]), destination];
  const endpoints: ReadonlyArray<Readonly<{ from: CourseV1ConnectorPlace; to: CourseV1ConnectorPlace }>> = course.legs.map((_, index) => ({
    from: points[index],
    to: points[index + 1],
  }));
  const requests: CourseV1ConnectorRequest[] = [];
  course.legs.forEach((leg, legIndex) => {
    if (leg.mode !== 'transit' || !hasValidGeometry(leg.geometry)) return;
    const firstPath = leg.geometry.paths[0];
    const lastPath = leg.geometry.paths.at(-1)!;
    const firstPoint = firstPath.points[0];
    const lastPoint = lastPath.points.at(-1)!;
    const expected = endpoints[legIndex];
    if (distanceMeters(expected.from, firstPoint) > CONNECTOR_GAP_METERS) {
      requests.push({ key: `${legIndex}:start`, legIndex, endpoint: 'start', from: expected.from, to: firstPoint });
    }
    if (distanceMeters(lastPoint, expected.to) > CONNECTOR_GAP_METERS) {
      requests.push({ key: `${legIndex}:end`, legIndex, endpoint: 'end', from: lastPoint, to: expected.to });
    }
  });
  return requests.slice(0, CONNECTOR_LIMIT);
}

/** 호출은 2곳 상세 기준 최대 6개·동시 2개이며 결과는 응답 도착 순서가 아닌 request 순서로 돌려준다. */
export async function loadCourseV1WalkConnectors(
  requests: readonly CourseV1ConnectorRequest[],
  port: PrivateWalkConnectorPort,
): Promise<CourseV1ConnectorLoadResult> {
  const bounded = requests.slice(0, CONNECTOR_LIMIT);
  const results: Array<CourseV1LoadedConnector | null> = Array.from({ length: bounded.length }, () => null);
  let cursor = 0;
  const worker = async () => {
    while (cursor < bounded.length) {
      const index = cursor;
      cursor += 1;
      const request = bounded[index];
      try {
        const result = await port.getConnector(request.from, request.to);
        if (result.status === 'exact_geometry' && hasValidGeometry(result.geometry)) {
          results[index] = { key: request.key, geometry: result.geometry };
        }
      } catch {
        // connector 실패는 해당 도보선만 생략한다.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONNECTOR_CONCURRENCY, bounded.length) }, worker));
  const connectors = results.filter((result): result is CourseV1LoadedConnector => result !== null);
  return { connectors, failedCount: requests.length - connectors.length };
}

function distanceMeters(a: CourseV1ConnectorPlace, b: CourseV1ConnectorPlace): number {
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(haversine));
}

function validPoint(point: CourseV1ConnectorPlace | undefined): point is CourseV1ConnectorPlace {
  return Boolean(point)
    && Number.isFinite(point?.lat)
    && Number.isFinite(point?.lon)
    && point!.lat >= -90
    && point!.lat <= 90
    && point!.lon >= -180
    && point!.lon <= 180;
}

function hasValidGeometry(geometry: CourseV1RouteGeometry | undefined): geometry is CourseV1RouteGeometry {
  if (!geometry || !Array.isArray(geometry.paths) || geometry.paths.length < 1 || geometry.paths.length > COURSE_V1_ROUTE_GEOMETRY_PATH_LIMIT) return false;
  let pointCount = 0;
  for (const path of geometry.paths) {
    if (!path || !Array.isArray(path.points) || path.points.length < 2) return false;
    pointCount += path.points.length;
    if (pointCount > COURSE_V1_ROUTE_GEOMETRY_POINT_LIMIT) return false;
    for (const point of path.points) {
      if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lon)) return false;
      if (point.lat < -90 || point.lat > 90 || point.lon < -180 || point.lon > 180) return false;
    }
  }
  return true;
}
