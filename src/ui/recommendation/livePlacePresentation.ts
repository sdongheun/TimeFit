import type { MultiSourceLiveProjection } from '../../data/busanLiveProjection';
import type { RecommendationSession } from '../nav';
import type { PlaceDetailCatalogPlace } from '../placeDetailModel';
import type { PlacePhotoInput } from '../placePhotoModel';
import { reviewedPlacePhotoCompatibility } from '../reviewedPlacePhotoCompatibility';
import { placeDisplayTitle } from '../placeDisplayTitle';

/** Only display-ready facts are carried across navigation; source responses and credentials never are. */
export type LiveDisplayPlace = Readonly<PlaceDetailCatalogPlace & { category: string }>;
type LiveCoursePlaceIdentity = Readonly<Pick<LiveDisplayPlace, 'contentId' | 'title' | 'lat' | 'lon' | 'category' | 'subCategory' | 'shortStay' | 'imageUrl' | 'imageSource' | 'imageEvidence'>>;
type LiveDisplaySession = RecommendationSession & {
  __livePlaceSnapshotId?: string;
  __liveSelectedPlaces?: readonly LiveCoursePlaceIdentity[];
};
const livePlaces = new WeakMap<RecommendationSession, ReadonlyMap<string, LiveDisplayPlace>>();
const clock = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
const validHttps = (value: string) => {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
};

function displayPlace(candidate: MultiSourceLiveProjection['candidates'][number]): LiveDisplayPlace {
  const { facts, policy } = candidate;
  const availability = facts.availability;
  const day = availability.dayTypes.includes('weekday') && availability.dayTypes.includes('weekend')
    ? '매일' : availability.dayTypes.includes('weekday') ? '평일' : availability.dayTypes.includes('weekend') ? '주말' : '';
  const operatingHours = availability.status !== 'structured' ? []
    : availability.alwaysAccessible ? ['상시 이용 가능']
      : availability.windows.filter(({ startMin, endMin }) => Number.isInteger(startMin) && Number.isInteger(endMin)
        && startMin >= 0 && endMin <= 1440 && endMin > startMin)
        .map(({ startMin, endMin }) => `${day ? `${day} ` : ''}${clock(startMin)}–${clock(endMin)}`);
  const photo = facts.photo?.status === 'approved' && validHttps(facts.photo.url) && validHttps(facts.photo.sourcePageUrl)
    ? facts.photo : undefined;
  // Live place facts never fall back to the bundle. A reviewed image is a separate display asset:
  // it may be reused only for the exact internal place id and must still pass the existing photo gate.
  const reviewedPhoto = reviewedPlacePhotoCompatibility(candidate.id);
  const photoPresentation: PlacePhotoInput = photo
    ? { imageUrl: photo.url, imageSource: 'busan_official', imageEvidence: { liveApprovedPhoto: photo } }
    : reviewedPhoto
      ? { imageUrl: reviewedPhoto.imageUrl, imageSource: reviewedPhoto.imageSource, imageEvidence: reviewedPhoto.imageEvidence }
      : {};
  return Object.freeze({
    contentId: candidate.id,
    title: placeDisplayTitle(facts.title),
    lat: facts.lat,
    lon: facts.lon,
    category: policy.category,
    subCategory: policy.subCategory ?? null,
    shortStay: { type: policy.activityType },
    addr1: facts.address ?? null,
    detailDescription: facts.description ?? null,
    operatingHours,
    ...photoPresentation,
  });
}

export function attachLivePlaceSnapshot(session: RecommendationSession, projection: MultiSourceLiveProjection): void {
  if (!projection.liveSourceSnapshotId || projection.status === 'unavailable') throw new Error('live_display_unavailable');
  const places = new Map<string, LiveDisplayPlace>();
  for (const candidate of projection.candidates) {
    if (candidate.state !== 'active' || places.has(candidate.id)) throw new Error('live_display_invalid');
    places.set(candidate.id, displayPlace(candidate));
  }
  livePlaces.set(session, places);
  (session as LiveDisplaySession).__livePlaceSnapshotId = projection.liveSourceSnapshotId;
}

/** Persist only the chosen 1–2 route/completion identities and approved photo presentation, never live source facts. */
export function preserveSelectedLivePlaces(session: RecommendationSession, placeIds: readonly string[]): boolean {
  const live = session as LiveDisplaySession;
  if (!live.__livePlaceSnapshotId) return true;
  if (!placeIds.length || placeIds.length > 2 || new Set(placeIds).size !== placeIds.length) return false;
  const source = livePlaces.get(session);
  const selected = placeIds.map((id) => source?.get(id) ?? live.__liveSelectedPlaces?.find((place) => place.contentId === id));
  if (selected.some((place) => !place)) return false;
  live.__liveSelectedPlaces = Object.freeze(selected.map((place) => Object.freeze({
    contentId: place!.contentId,
    title: place!.title,
    lat: place!.lat,
    lon: place!.lon,
    category: place!.category,
    subCategory: place!.subCategory ?? null,
    shortStay: place!.shortStay ?? null,
    ...(place!.imageUrl ? { imageUrl: place!.imageUrl, imageSource: place!.imageSource ?? null, imageEvidence: place!.imageEvidence } : {}),
  })));
  return true;
}

/** A live session must never silently fall back to a stale bundled place. */
export function resolveRecommendationPlace<T extends PlaceDetailCatalogPlace>(
  session: RecommendationSession,
  placeId: string,
  staticLookup: () => T | undefined,
): LiveDisplayPlace | T | undefined {
  const live = session as LiveDisplaySession;
  if (!live.__livePlaceSnapshotId) return staticLookup();
  return livePlaces.get(session)?.get(placeId) ?? live.__liveSelectedPlaces?.find((place) => place.contentId === placeId);
}
