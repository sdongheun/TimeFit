// @ts-nocheck
import { sanitizeKakaoTransitSegments } from '../route-proxy/handler.ts';

type Point = { lat: number; lon: number };
const ROUTE_LIMIT = 32;
const routeTypes = new Set(['BUS', 'SUBWAY', 'BUS_AND_SUBWAY']);

const routeType = (value: unknown) => typeof value === 'string' && routeTypes.has(value) ? value : 'UNKNOWN';
const stepType = (value: unknown) => value === 'WALKING' || value === 'BUS' || value === 'SUBWAY' ? value : 'UNKNOWN';
const stepMode = (value: unknown) => value === 'WALKING' ? 'walk' : value === 'BUS' || value === 'SUBWAY' ? 'transit' : 'unknown';
const pointCount = (step: any) => Array.isArray(step?.path?.points)
  ? step.path.points.filter((value: unknown) => Array.isArray(value) && value.length === 2
    && Number.isFinite(value[0]) && value[0] >= -180 && value[0] <= 180
    && Number.isFinite(value[1]) && value[1] >= -90 && value[1] <= 90).length
  : 0;
const minute = (value: unknown) => Number.isFinite(Number(value)) && Number(value) > 0 ? Math.ceil(Number(value) / 60) : null;
const transferCount = (value: unknown) => Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null;
const gapBucket = (value: number | undefined) => value === undefined ? 'unavailable'
  : value <= 25 ? '0_25m' : value <= 50 ? '26_50m' : value <= 100 ? '51_100m' : value <= 250 ? '101_250m' : 'over_250m';

export function summarizeKakaoTransitRoutes(raw: any, endpoints: { origin: Point; destination: Point }) {
  const allRoutes = Array.isArray(raw?.routes) ? raw.routes : [];
  const routes = allRoutes.slice(0, ROUTE_LIMIT).map((route: any, routeIndex: number) => {
    const steps = Array.isArray(route?.steps) ? route.steps : [];
    const counts = steps.map(pointCount);
    const sanitized = sanitizeKakaoTransitSegments(route, endpoints);
    return {
      routeIndex,
      routeType: routeType(route?.properties?.type),
      totalMin: minute(route?.properties?.totalTime),
      transfers: transferCount(route?.properties?.transfers),
      stepModeOrder: steps.map((step: any) => stepMode(step?.properties?.type)),
      steps: steps.map((step: any, index: number) => ({ type: stepType(step?.properties?.type), validPointCount: counts[index] })),
      firstStepType: stepType(steps[0]?.properties?.type),
      lastStepType: stepType(steps.at(-1)?.properties?.type),
      startEndpointGap: gapBucket(sanitized.endpointDistanceM?.start),
      endEndpointGap: gapBucket(sanitized.endpointDistanceM?.end),
      hasLeadingWalkingPath: steps[0]?.properties?.type === 'WALKING' && counts[0] >= 2,
      hasTerminalWalkingPath: steps.at(-1)?.properties?.type === 'WALKING' && counts.at(-1)! >= 2,
    };
  });
  return { routeCount: allRoutes.length, routes, truncated: allRoutes.length > ROUTE_LIMIT };
}
