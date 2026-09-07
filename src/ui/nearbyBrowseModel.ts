import { approvedPlacePhoto, type PlacePhotoInput } from './placePhotoModel';
export const NEARBY_RADIUS_M = 3000;

export type NearbyPoint = Readonly<{ lat: number; lon: number }>;
export type NearbyCatalogPlace = PlacePhotoInput & Readonly<{
  contentId: string;
  title: string;
  lat: number;
  lon: number;
  classification: string;
  category?: string | null;
  subCategory?: string | null;
  addr1?: string | null;
  imageUrl?: string | null;
  imageSource?: string | null;
  detailDescription?: string | null;
  operatingHours?: readonly string[] | null;
  mapVerification?: { status?: string | null; placeId?: string | null; placeUrl?: string | null } | null;
}>;

export type NearbyBrowsePlace = NearbyPoint & Readonly<{
  id: string;
  title: string;
  categoryLabel: string;
  addressLabel: string;
  description: string;
  hoursLabel: string;
  distanceM: number;
  displayDistance: string;
  informationKind: 'verified' | 'conditional';
  imageUrl: string | null;
  source: NearbyCatalogPlace;
}>;

const ELIGIBLE = new Set(['representative_core', 'representative_standard', 'conditional_more']);

export function directDistanceM(a: NearbyPoint, b: NearbyPoint): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function validPoint(point: NearbyPoint): boolean {
  return Number.isFinite(point.lat) && Number.isFinite(point.lon) && Math.abs(point.lat) <= 90 && Math.abs(point.lon) <= 180;
}

export function formatNearbyDistance(distanceM: number): string {
  return distanceM < 1000 ? `${Math.round(distanceM / 10) * 10}m` : `${(distanceM / 1000).toFixed(1)}km`;
}

/** 공개 카탈로그를 정보 탐색용으로만 변환한다. 추천 가능성이나 현재 영업 여부를 추론하지 않는다. */
export function buildNearbyBrowseDataset(
  center: NearbyPoint,
  catalog: readonly NearbyCatalogPlace[],
  radiusM = NEARBY_RADIUS_M,
): NearbyBrowsePlace[] {
  if (!validPoint(center) || !Number.isFinite(radiusM) || radiusM < 0) return [];
  const seen = new Set<string>();
  const rows: NearbyBrowsePlace[] = [];
  for (const place of catalog) {
    const id = place.contentId?.trim();
    if (!id || seen.has(id) || !validPoint(place) || !ELIGIBLE.has(place.classification)) continue;
    seen.add(id);
    const distanceM = directDistanceM(center, place);
    if (distanceM > radiusM) continue;
    const hours = place.operatingHours?.map(value => value.trim()).filter(Boolean) ?? [];
    const categoryLabel = [place.category?.trim(), place.subCategory?.trim()].filter(Boolean).join(' · ') || '장소 정보';
    rows.push({
      id,
      title: place.title?.trim() || '이름 없는 장소',
      lat: place.lat,
      lon: place.lon,
      categoryLabel,
      addressLabel: place.addr1?.trim() || '주소 정보 없음',
      description: place.detailDescription?.trim() || '상세 설명 없음',
      hoursLabel: hours.length ? hours.join(' · ') : '운영시간 확인 필요',
      distanceM,
      displayDistance: formatNearbyDistance(distanceM),
      informationKind: place.classification === 'conditional_more' ? 'conditional' : 'verified',
      imageUrl: approvedPlacePhoto(place)?.url ?? null,
      source: place,
    });
  }
  return rows.sort((left, right) => left.distanceM - right.distanceM || left.id.localeCompare(right.id));
}

export type NearbyMarkerCluster = Readonly<{ ids: readonly string[]; lat: number; lon: number }>;

/** 지도 projection 결과를 받아 겹침만 묶는다. 원본 목록은 변경하지 않는다. */
export function clusterNearbyMarkers(
  rows: readonly NearbyBrowsePlace[],
  project: (point: NearbyPoint) => Readonly<{ x: number; y: number }>,
  thresholdPx = 44,
): NearbyMarkerCluster[] {
  const groups: { ids: string[]; lat: number; lon: number; x: number; y: number }[] = [];
  for (const row of rows) {
    const p = project(row);
    const group = groups.find(item => Math.hypot(item.x - p.x, item.y - p.y) <= thresholdPx);
    if (group) group.ids.push(row.id);
    else groups.push({ ids: [row.id], lat: row.lat, lon: row.lon, x: p.x, y: p.y });
  }
  return groups.map(({ ids, lat, lon }) => ({ ids, lat, lon }));
}

export function createNearbySelectionState(validIds: readonly string[]) {
  const allowed = new Set(validIds);
  let selectedId: string | null = null;
  let detailId: string | null = null;
  return {
    select(id: string) { if (!allowed.has(id)) return false; selectedId = id; return true; },
    openDetail(id: string) { if (!allowed.has(id)) return false; selectedId = id; detailId = id; return true; },
    closeDetail() { detailId = null; },
    snapshot: () => ({ selectedId, detailId }),
  };
}

/** 비동기 GPS 결과는 가장 최근 요청 한 번만 소비한다. 수동 선택/이탈은 invalidate한다. */
export function createNearbyLocationGuard() {
  let generation = 0;
  let consumed = false;
  return {
    begin() { consumed = false; return ++generation; },
    invalidate() { consumed = false; generation += 1; },
    current(token: number) { return token === generation; },
    accept(token: number) { if (token !== generation || consumed) return false; consumed = true; return true; },
  };
}

export type NearbyMapFailureReason = 'sdk_load' | 'sdk_unavailable' | 'sdk_init' | 'runtime' | 'navigation' | 'http' | 'timeout';
export type NearbyMapMessage = Readonly<{ action: 'select'; id: string }> | Readonly<{ action: 'cluster'; ids: readonly string[] }> | Readonly<{ action: 'ready' }> | Readonly<{ action: 'error'; reason?: NearbyMapFailureReason }>;

export function parseNearbyMapMessage(raw: unknown, currentIds: ReadonlySet<string>): NearbyMapMessage | null {
  if (typeof raw !== 'string' || raw.length > 20_000) return null;
  try {
    const value = JSON.parse(raw) as { action?: unknown; id?: unknown; ids?: unknown; reason?: unknown };
    if (value.action === 'ready') return { action: 'ready' };
    if (value.action === 'error') {
      const reasons = new Set(['sdk_load', 'sdk_unavailable', 'sdk_init', 'runtime', 'navigation', 'http', 'timeout']);
      return { action: 'error', ...(typeof value.reason === 'string' && reasons.has(value.reason) ? { reason: value.reason as NearbyMapFailureReason } : {}) };
    }
    if (value.action === 'select' && typeof value.id === 'string' && currentIds.has(value.id)) return { action: 'select', id: value.id };
    if (value.action === 'cluster' && Array.isArray(value.ids) && value.ids.length > 1 && value.ids.every(id => typeof id === 'string' && currentIds.has(id))) return { action: 'cluster', ids: [...new Set(value.ids as string[])] };
  } catch { return null; }
  return null;
}
