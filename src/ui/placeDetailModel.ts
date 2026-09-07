import type { RouteMapMarker } from './KakaoRouteMap';
import type { RecommendationSession } from './nav';
import { approvedPlacePhoto, photoMarkerFields, type PlacePhotoInput } from './placePhotoModel';

export type PlaceDetailSelectionKind = 'first' | 'pair';
export type PlaceDetailRequestIdentity = Readonly<{
  requestId: string;
  selectionKind: PlaceDetailSelectionKind;
  courseId: string;
  placeId: string;
}>;

export type PlaceDetailCatalogPlace = PlacePhotoInput & Readonly<{
  contentId: string;
  title: string;
  lat: number;
  lon: number;
  category?: string | null;
  subCategory?: string | null;
  addr1?: string | null;
  imageUrl?: string | null;
  imageSource?: string | null;
  detailDescription?: string | null;
  operatingHours?: readonly string[] | null;
  shortStay?: { type?: string | null } | null;
  mapVerification?: { status?: string | null; placeId?: string | null; placeUrl?: string | null } | null;
}>;

export type PlaceDetailModel = Readonly<{
  title: string;
  categoryLabel: string;
  description: string;
  operatingHoursLabel: string;
  addressLabel: string;
  selectionLabel: '이 장소 선택하기' | '함께 선택하기';
  image: Readonly<{ kind: 'remote'; url: string }> | Readonly<{ kind: 'category_fallback'; label: string }>;
}>;

let requestSequence = 0;
const defaultRequestId = () => `place-detail-${++requestSequence}`;

/** navigation params에 callback을 넣지 않고 상세의 명시 선택만 원래 Results가 한 번 소비한다. */
export function createPlaceDetailSelectionHandoff(createRequestId: () => string = defaultRequestId) {
  let active: PlaceDetailRequestIdentity | null = null;
  let selected = false;
  return {
    issue(input: Omit<PlaceDetailRequestIdentity, 'requestId'>): PlaceDetailRequestIdentity {
      active = { requestId: createRequestId(), ...input };
      selected = false;
      return active;
    },
    select(request: PlaceDetailRequestIdentity): boolean {
      if (!active || selected || !sameRequest(active, request)) return false;
      selected = true;
      return true;
    },
    consume(request: PlaceDetailRequestIdentity): PlaceDetailRequestIdentity | null {
      if (!active || !selected || !sameRequest(active, request)) return null;
      const result = active;
      active = null;
      selected = false;
      return result;
    },
    cancel(request: PlaceDetailRequestIdentity): void {
      if (!active || !sameRequest(active, request)) return;
      active = null;
      selected = false;
    },
  };
}

const sameRequest = (a: PlaceDetailRequestIdentity, b: PlaceDetailRequestIdentity) => a.requestId === b.requestId
  && a.selectionKind === b.selectionKind && a.courseId === b.courseId && a.placeId === b.placeId;

export const placeDetailSelectionHandoff = createPlaceDetailSelectionHandoff();

export function buildPlaceDetailModel(place: PlaceDetailCatalogPlace, selectionKind: PlaceDetailSelectionKind): PlaceDetailModel {
  const categoryLabel = [place.category?.trim(), place.subCategory?.trim()].filter(Boolean).join(' · ') || '장소 정보';
  const hours = place.operatingHours?.map((value) => value.trim()).filter(Boolean) ?? [];
  const imageUrl = approvedPlacePhoto(place)?.url;
  return {
    title: place.title,
    categoryLabel,
    description: place.detailDescription?.trim() || '상세 설명 없음',
    operatingHoursLabel: hours.length ? hours.join(' · ') : '운영시간 확인 필요',
    addressLabel: place.addr1?.trim() || '주소 정보 없음',
    selectionLabel: selectionKind === 'first' ? '이 장소 선택하기' : '함께 선택하기',
    image: imageUrl?.startsWith('https://') ? { kind: 'remote', url: imageUrl } : { kind: 'category_fallback', label: categoryLabel },
  };
}

const validPoint = (point: { lat: number; lon: number } | null | undefined) => Boolean(point
  && Number.isFinite(point.lat) && Number.isFinite(point.lon) && Math.abs(point.lat) <= 90 && Math.abs(point.lon) <= 180);

/** 방문 순서나 근사선을 만들지 않고 허용된 위치 snapshot과 선택 맥락만 표시한다. */
export function buildPlaceDetailMarkers(
  session: RecommendationSession,
  candidate: PlaceDetailCatalogPlace,
  selected?: PlaceDetailCatalogPlace,
): RouteMapMarker[] {
  const markers: RouteMapMarker[] = [];
  if (validPoint(session.deviceLocationSnapshot)) markers.push({ ...session.deviceLocationSnapshot!, label: '현재 위치', kind: 'current' });
  if (validPoint(session.origin)) markers.push({ lat: session.origin.lat, lon: session.origin.lon, label: '설정한 출발지', kind: 'origin' });
  if (selected && validPoint(selected)) markers.push({ lat: selected.lat, lon: selected.lon, label: `선택한 장소 · ${selected.title}`, kind: 'selected' });
  if (validPoint(candidate)) markers.push({ lat: candidate.lat, lon: candidate.lon, label: `선택 후보 · ${candidate.title}`, kind: 'candidate', ...photoMarkerFields(candidate) });
  return normalizeCoLocatedMarkers(markers);
}

export function normalizeCoLocatedMarkers(markers: readonly RouteMapMarker[]): RouteMapMarker[] {
  const normalized: RouteMapMarker[] = [];
  for (const marker of markers) {
    const existingIndex = normalized.findIndex((item) => item.lat === marker.lat && item.lon === marker.lon);
    if (existingIndex < 0) normalized.push({ ...marker });
    else {
      const existing = normalized[existingIndex];
      normalized[existingIndex] = { ...existing, label: `${existing.label} · ${marker.label}` };
    }
  }
  return normalized;
}
