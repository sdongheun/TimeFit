import type { VerifiedCourseV1 } from '../../engine';
import type { RecommendationSession } from '../nav';
import type { RouteMapMarker } from '../KakaoRouteMap';
import { getPlaceActivityLabel } from './courseV1DiscoveryContext';
import type { CourseV1DisplayPlace } from './courseV1PlacePreviewModel';
import { photoMarkerFields } from '../placePhotoModel';

export type CourseV1CatalogDisplayPlace = CourseV1DisplayPlace & {
  category?: string | null;
  shortStay?: { type?: string | null } | null;
};

export type CourseV1CardSummary = {
  label: string;
  course: VerifiedCourseV1;
  place: CourseV1CatalogDisplayPlace;
  activityLabel: string;
  courseMin: number;
  short: boolean;
  accessibilityLabel: string;
};

export type CourseV1DetailStop = {
  placeId: string;
  place: CourseV1CatalogDisplayPlace;
  activityLabel: string;
  stayMin: number;
  stayLabel: string;
};

export type CourseV1DetailModel = {
  courseMin: number;
  originLabel: string;
  destinationLabel: string;
  returnsToOrigin: boolean;
  legs: VerifiedCourseV1['legs'];
  stops: CourseV1DetailStop[];
  arrivalBufferMin: number;
};

const validMinute = (value: number): boolean => Number.isInteger(value) && value >= 0;

/** 표시 전에 원본 snapshot의 순서와 합계를 검증한다. 깨진 값은 보정하지 않고 전부 닫는다. */
export function hasValidCourseV1DisplaySnapshot(course: VerifiedCourseV1): boolean {
  if (!course.placeIds.length || course.stops.length !== course.placeIds.length || course.legs.length !== course.placeIds.length + 1) return false;
  if (![course.travelMin, course.stayMin, course.totalMin, course.arrivalBufferMin].every(validMinute)) return false;
  if (!course.legs.every((leg) => validMinute(leg.min)) || !course.stops.every((stop) => validMinute(stop.stayMin))) return false;

  for (let index = 0; index < course.placeIds.length; index += 1) {
    const placeId = course.placeIds[index];
    const stop = course.stops[index];
    const leg = course.legs[index];
    if (!placeId || stop.placeId !== placeId || leg.toId !== placeId) return false;
    if (index > 0 && leg.fromId !== course.placeIds[index - 1]) return false;
  }
  const lastLeg = course.legs.at(-1);
  if (!lastLeg || lastLeg.fromId !== course.placeIds.at(-1)) return false;

  const travelMin = course.legs.reduce((sum, leg) => sum + leg.min, 0);
  const stayMin = course.stops.reduce((sum, stop) => sum + stop.stayMin, 0);
  return course.travelMin === travelMin
    && course.stayMin === stayMin
    && course.totalMin === travelMin + stayMin + course.arrivalBufferMin;
}

export function buildCourseV1CardSummary(
  course: VerifiedCourseV1,
  label: string,
  getPlace: (placeId: string) => CourseV1CatalogDisplayPlace | undefined,
): CourseV1CardSummary | null {
  if (!hasValidCourseV1DisplaySnapshot(course) || course.placeIds.length !== 1) return null;
  const place = getPlace(course.placeIds[0]);
  const activityLabel = getPlaceActivityLabel(place);
  if (!place?.title?.trim() || !activityLabel) return null;
  const short = course.stops[0].stayState === 'short';
  const courseMin = course.travelMin + course.stayMin;
  return {
    label,
    course,
    place,
    activityLabel,
    courseMin,
    short,
    accessibilityLabel: [label, place.title, activityLabel, `약 ${courseMin}분 코스`, short ? '가볍게 둘러보기' : null].filter(Boolean).join(', '),
  };
}

export function buildCourseV1DetailModel(
  course: VerifiedCourseV1,
  session: RecommendationSession,
  getPlace: (placeId: string) => CourseV1CatalogDisplayPlace | undefined,
): CourseV1DetailModel | null {
  if (!hasValidCourseV1DisplaySnapshot(course)) return null;
  const stops: CourseV1DetailStop[] = [];
  for (let index = 0; index < course.stops.length; index += 1) {
    const stop = course.stops[index];
    const place = getPlace(stop.placeId);
    const activityLabel = getPlaceActivityLabel(place);
    if (!place?.title?.trim() || !activityLabel) return null;
    const short = stop.stayState === 'short';
    stops.push({
      placeId: stop.placeId,
      place,
      activityLabel,
      stayMin: stop.stayMin,
      stayLabel: `${short ? '가볍게 둘러보기' : '둘러보기'} 약 ${stop.stayMin}분`,
    });
  }
  return {
    courseMin: course.travelMin + course.stayMin,
    originLabel: session.origin.label,
    destinationLabel: session.destination?.label ?? '출발지로 복귀',
    returnsToOrigin: session.destination === null,
    legs: course.legs,
    stops,
    arrivalBufferMin: course.arrivalBufferMin,
  };
}

const validCoordinate = (lat: number, lon: number): boolean => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

/** 실제 geometry 없이 지도에 필요한 검증 순서의 marker만 만든다. 왕복 좌표는 한 핀으로 합친다. */
export function buildCourseV1DetailMarkers(
  model: CourseV1DetailModel,
  session: RecommendationSession,
): RouteMapMarker[] | null {
  if (!validCoordinate(session.origin.lat, session.origin.lon)) return null;
  if (model.stops.some(({ place }) => !validCoordinate(place.lat, place.lon))) return null;
  if (session.destination && !validCoordinate(session.destination.lat, session.destination.lon)) return null;

  const markers: RouteMapMarker[] = [{
    lat: session.origin.lat,
    lon: session.origin.lon,
    label: model.returnsToOrigin ? '출발·복귀' : session.origin.label,
    kind: 'origin',
  }];
  model.stops.forEach(({ place }, index) => markers.push({ lat: place.lat, lon: place.lon, label: place.title, kind: 'spot', active: index === 0, ...photoMarkerFields(place) }));
  if (session.destination) markers.push({ lat: session.destination.lat, lon: session.destination.lon, label: session.destination.label, kind: 'appointment' });
  return markers;
}
