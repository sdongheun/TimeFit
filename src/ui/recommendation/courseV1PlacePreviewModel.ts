export type CourseV1DisplayPlace = {
  title: string;
  lat: number;
  lon: number;
  imageUrl?: string | null;
  imageSource?: 'busan_official' | 'tourapi' | string | null;
  mapVerification?: { placeUrl?: string | null } | null;
};

export type PlacePreviewKind = { kind: 'image'; sourceLabel: string } | { kind: 'placeholder' };

function isHttpsUrl(value: string | null | undefined): boolean {
  try { return new URL(value ?? '').protocol === 'https:'; } catch { return false; }
}

export function getPlacePreviewKind(place: CourseV1DisplayPlace, imageFailed: boolean): PlacePreviewKind {
  if (!imageFailed && isHttpsUrl(place.imageUrl)) {
    return { kind: 'image', sourceLabel: place.imageSource === 'tourapi' ? 'TourAPI 제공 사진' : '부산시 공식 사진' };
  }
  return { kind: 'placeholder' };
}

/** 검증된 카카오 URL만 우선하고, 그 외에는 제목·좌표를 담은 HTTPS 검색 URL을 쓴다. */
export function buildKakaoPlaceUrl(place: CourseV1DisplayPlace): string | null {
  if (isHttpsUrl(place.mapVerification?.placeUrl)) return place.mapVerification!.placeUrl!;
  if (!place.title || !Number.isFinite(place.lat) || !Number.isFinite(place.lon)) return null;
  return `https://map.kakao.com/link/search/${encodeURIComponent(`${place.title} ${place.lat},${place.lon}`)}`;
}

export async function openKakaoPlace(place: CourseV1DisplayPlace, openUrl: (url: string) => Promise<unknown>): Promise<'opened' | 'failed'> {
  const url = buildKakaoPlaceUrl(place);
  if (!url) return 'failed';
  try { await openUrl(url); return 'opened'; } catch { return 'failed'; }
}
