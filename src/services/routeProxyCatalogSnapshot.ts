import runtimeCatalog from '../data/busan_poi_catalog.json';

export type RouteProxyCatalogPoint = { lat: number; lon: number };
export type RouteProxyCatalogSnapshot = { version: string; points: Readonly<Record<string, RouteProxyCatalogPoint>>; json: string };
type SnapshotPlace = { id: string; lat: number; lon: number; classification: string };

const representative = new Set(['representative_core', 'representative_standard']);
const runtimePlaces = [...runtimeCatalog.matched.data, ...runtimeCatalog.unmatched.data].map((place) => ({ id: place.contentId, lat: place.lat, lon: place.lon, classification: place.classification }));

const validPoint = (place: SnapshotPlace) => typeof place.id === 'string' && place.id.length > 0 && Number.isFinite(place.lat) && place.lat >= -90 && place.lat <= 90 && Number.isFinite(place.lon) && place.lon >= -180 && place.lon <= 180;
const hash = (input: string) => {
  let value = 0x811c9dc5;
  for (const char of input) { value ^= char.charCodeAt(0); value = Math.imul(value, 0x01000193) >>> 0; }
  return value.toString(16).padStart(8, '0');
};

/**
 * Deployment input only: this converts already-classified representative catalog points.
 * It never evaluates availability/evidence policy and contains no request or user data.
 */
export function buildRouteProxyCatalogSnapshot(input: readonly SnapshotPlace[] = runtimePlaces): RouteProxyCatalogSnapshot {
  const selected = input.filter((place) => representative.has(place.classification)).sort((left, right) => left.id.localeCompare(right.id));
  const points: Record<string, RouteProxyCatalogPoint> = {};
  for (const place of selected) {
    if (!validPoint(place) || points[place.id]) throw new Error(`invalid route proxy snapshot point: ${place.id}`);
    points[place.id] = { lat: place.lat, lon: place.lon };
  }
  const canonical = JSON.stringify(points);
  const version = `representative-${hash(canonical)}`;
  return Object.freeze({ version, points: Object.freeze(points), json: JSON.stringify({ version, points }) });
}

/** Server config must receive this JSON through its secret/config deployment path; mobile code does not send it. */
export const routeProxyCatalogSnapshot = buildRouteProxyCatalogSnapshot();
export const ROUTE_PROXY_CATALOG_SNAPSHOT_VERSION = routeProxyCatalogSnapshot.version;
