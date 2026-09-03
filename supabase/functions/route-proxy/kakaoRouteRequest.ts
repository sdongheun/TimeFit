export type KakaoRouteKind = 'walk' | 'publictraffic';
export type KakaoRoutePoint = { lat: number; lon: number };

const routeStatuses = new Set(['OK', 'STARTNODES_NULL', 'ENDNODES_NULL', 'EQUAL_POINTS', 'INVALID_REQUEST', 'NO_RESULTS']);
const validPoint = (value: KakaoRoutePoint) => Number.isFinite(value?.lat) && value.lat >= -90 && value.lat <= 90
  && Number.isFinite(value?.lon) && value.lon >= -180 && value.lon <= 180;

export function buildKakaoRouteRequest(kind: KakaoRouteKind, input: {
  origin: KakaoRoutePoint;
  destination: KakaoRoutePoint;
  key: string;
}) {
  const key = input.key.trim();
  if (!key || !validPoint(input.origin) || !validPoint(input.destination)
    || (input.origin.lat === input.destination.lat && input.origin.lon === input.destination.lon)) throw new Error('invalid_kakao_route_request');
  const query = new URLSearchParams({
    start_x: String(input.origin.lon), start_y: String(input.origin.lat),
    end_x: String(input.destination.lon), end_y: String(input.destination.lat),
    input_coord: 'WGS84', output_coord: 'WGS84',
  });
  return {
    method: 'GET' as const,
    url: `https://dapi.kakao.com/v2/routing/${kind}?${query}`,
    headers: { Authorization: `KakaoAK ${key}` },
  };
}

export const safeKakaoRouteStatus = (value: unknown) => typeof value === 'string' && routeStatuses.has(value) ? value : 'unknown';
export const safeKakaoErrorCode = (value: unknown) => Number.isInteger(value) ? value as number : null;
