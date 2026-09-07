import type { RouteMapMarker } from '../KakaoRouteMap';
export type CompletedMapPlace = Readonly<{ contentId: string; title: string }>;
export function monthCompletionPlaces(records: readonly { completedAt: number; places: readonly CompletedMapPlace[] }[], nowMs = Date.now()): CompletedMapPlace[] {
  const now = new Date(nowMs);
  return records.filter(record => {
    const date = new Date(record.completedAt);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }).flatMap(record => [...record.places]);
}
/** 표시 시 공개 카탈로그만 조회한다. 기록에 좌표를 저장하거나 원격 장소 검색을 하지 않는다. */
export function completedPlaceMarkers(places: readonly CompletedMapPlace[], catalog: readonly { contentId: string; lat: number; lon: number }[]): RouteMapMarker[] {
  const index = new Map(catalog.map(place => [place.contentId, place]));
  const seen = new Set<string>();
  return places.flatMap(place => {
    if (seen.has(place.contentId)) return [];
    seen.add(place.contentId);
    const point = index.get(place.contentId);
    if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lon) || Math.abs(point.lat) > 90 || Math.abs(point.lon) > 180) return [];
    return [{ lat: point.lat, lon: point.lon, label: place.title, kind: 'spot' as const }];
  });
}
