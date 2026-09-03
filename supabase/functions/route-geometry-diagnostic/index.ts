// @ts-nocheck
// Diagnostic-only Edge entrypoint. This is never imported by the production route-proxy entrypoint.
import { buildKakaoRouteRequest, safeKakaoErrorCode, safeKakaoRouteStatus } from '../route-proxy/kakaoRouteRequest.ts';
import { summarizeKakaoTransitRoutes } from './summarizeKakaoTransitRoutes.ts';

type Point = { lat: number; lon: number };
const MAX_RESPONSE_BYTES = 2_000_000;
const SASANG_ANCHOR = { lat: 35.1622, lon: 128.9848 };
const SEOMYEON_ANCHOR = { lat: 35.1578, lon: 129.0594 };

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});
const validPoint = (value: unknown): value is Point => {
  const point = value as Point;
  return Number.isFinite(point?.lat) && point.lat >= -90 && point.lat <= 90
    && Number.isFinite(point?.lon) && point.lon >= -180 && point.lon <= 180;
};
const radians = (degrees: number) => degrees * Math.PI / 180;
const distanceM = (left: Point, right: Point) => {
  const latDelta = radians(right.lat - left.lat); const lonDelta = radians(right.lon - left.lon);
  const value = Math.sin(latDelta / 2) ** 2
    + Math.cos(radians(left.lat)) * Math.cos(radians(right.lat)) * Math.sin(lonDelta / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)));
};
const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
const timingSafeEqual = async (left: string, right: string) => {
  const [leftHash, rightHash] = await Promise.all([digest(left), digest(right)]);
  let difference = 0;
  for (let index = 0; index < leftHash.length; index += 1) difference |= leftHash[index] ^ rightHash[index];
  return difference === 0;
};
const selectNearest = (points: Point[], anchor: Point) => points.reduce<Point | null>((best, point) => !best || distanceM(point, anchor) < distanceM(best, anchor) ? point : best, null);

async function callProvider(key: string, endpoints: { origin: Point; destination: Point }) {
  const request = buildKakaoRouteRequest('publictraffic', { ...endpoints, key });
  let response: Response;
  try {
    response = await fetch(request.url, { method: request.method, headers: request.headers, redirect: 'error', signal: AbortSignal.timeout(15_000) });
  } catch {
    return { httpStatus: 0, contentType: 'other', errorCode: null, status: 'unknown' };
  }
  const contentType = response.headers.get('content-type')?.toLowerCase().includes('json') ? 'json' : 'other';
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    return { httpStatus: response.status, contentType, errorCode: null, status: 'unknown' };
  }
  let raw: any = null;
  try {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength <= MAX_RESPONSE_BYTES && contentType === 'json') raw = JSON.parse(new TextDecoder().decode(bytes));
  } catch { raw = null; }
  const status = safeKakaoRouteStatus(raw?.status);
  const base = { httpStatus: response.status, contentType, errorCode: safeKakaoErrorCode(raw?.code), status };
  if (!response.ok || status !== 'OK') return base;
  return { ...base, ...summarizeKakaoTransitRoutes(raw, endpoints) };
}

Deno.serve(async (request) => {
  const expectedToken = Deno.env.get('ROUTE_GEOMETRY_DIAGNOSTIC_TOKEN') ?? '';
  const suppliedToken = request.headers.get('x-timefit-diagnostic-token') ?? '';
  if (!expectedToken || !suppliedToken || !(await timingSafeEqual(expectedToken, suppliedToken))) return json({ status: 'unauthorized', providerCallCount: 0 }, 401);
  if (request.method !== 'POST') return json({ status: 'method_not_allowed', providerCallCount: 0 }, 405);

  const key = (Deno.env.get('KAKAO_ROUTE_REST_API_KEY') ?? '').trim();
  const snapshotValue = Deno.env.get('ROUTE_PROXY_CATALOG_SNAPSHOT_JSON') ?? '';
  let snapshot: any = null;
  try { snapshot = JSON.parse(snapshotValue); } catch { snapshot = null; }
  const publicPoints = Object.values(snapshot?.points ?? {}).filter(validPoint);
  const c2Origin = selectNearest(publicPoints, SASANG_ANCHOR);
  const c2Destination = selectNearest(publicPoints, SEOMYEON_ANCHOR);
  const c2Distance = c2Origin && c2Destination ? distanceM(c2Origin, c2Destination) : null;
  const preflight = {
    keyPresent: Boolean(key),
    publicPairPresent: Boolean(c2Origin && c2Destination),
    publicPairDistinct: Boolean(c2Origin && c2Destination && (c2Origin.lat !== c2Destination.lat || c2Origin.lon !== c2Destination.lon)),
    publicPairDistance: c2Distance === null ? 'unknown' : c2Distance < 3000 ? 'under_3km' : c2Distance <= 15000 ? '3_15km' : 'over_15km',
  };
  if (!preflight.keyPresent || !preflight.publicPairPresent
    || !preflight.publicPairDistinct || preflight.publicPairDistance !== '3_15km' || !c2Origin || !c2Destination) {
    return json({ status: 'preflight_failed', providerCallCount: 0, preflight }, 503);
  }

  const c2 = await callProvider(key, { origin: c2Origin, destination: c2Destination });
  return json({ status: 'completed', providerCallCount: 1, preflight, c2 });
});
