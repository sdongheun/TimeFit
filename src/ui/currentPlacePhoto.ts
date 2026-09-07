import catalog from '../data/busan_poi_catalog.json';
import type { PlacePhotoInput } from './placePhotoModel';
const places = new Map<string, PlacePhotoInput>([...catalog.matched.data, ...catalog.unmatched.data].map(place => [place.contentId, place as PlacePhotoInput]));
/** 과거 저장/legacy URL을 사용하지 않고 같은 ID의 현행 공개 자료만 재조회한다. */
export function currentPlacePhoto(contentId: string): PlacePhotoInput { return places.get(contentId) ?? {}; }
