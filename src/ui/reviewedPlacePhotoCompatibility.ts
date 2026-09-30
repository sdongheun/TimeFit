import runtimeCatalog from '../data/busan_poi_catalog.json';
import { approvedPlacePhoto, type PlacePhotoInput } from './placePhotoModel';

type RuntimePlace = (typeof runtimeCatalog.matched.data)[number] | (typeof runtimeCatalog.unmatched.data)[number];
const reviewedByPlaceId = new Map<string, PlacePhotoInput>(
  [...runtimeCatalog.matched.data, ...runtimeCatalog.unmatched.data]
    .map((place) => place as RuntimePlace & PlacePhotoInput)
    .filter((place) => approvedPlacePhoto(place) !== null)
    .map((place) => [place.contentId, place]),
);

/**
 * Returns only an already-reviewed display asset for the exact internal place id.
 * This is not a fallback for live title, coordinates, opening hours, or description.
 */
export function reviewedPlacePhotoCompatibility(placeId: string): PlacePhotoInput | null {
  const place = reviewedByPlaceId.get(placeId);
  if (!place || approvedPlacePhoto(place) === null) return null;
  return Object.freeze({
    imageUrl: place.imageUrl,
    imageSource: place.imageSource,
    imageEvidence: place.imageEvidence,
  });
}
