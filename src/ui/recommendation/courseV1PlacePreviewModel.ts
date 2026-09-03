export type CourseV1DisplayPlace = {
  title: string;
  lat: number;
  lon: number;
  addr1?: string | null;
  category?: string | null;
  shortStay?: { type?: string | null } | null;
  imageUrl?: string | null;
  imageSource?: 'busan_official' | 'tourapi' | string | null;
  mapVerification?: { status?: string | null; placeId?: string | null; placeUrl?: string | null } | null;
};

export type PlacePreviewKind = { kind: 'image'; sourceLabel: string } | { kind: 'placeholder' };

function isHttpsUrl(value: string | null | undefined): boolean {
  try { return new URL(value ?? '').protocol === 'https:'; } catch { return false; }
}

function isVerifiedKakaoPlaceUrl(place: CourseV1DisplayPlace): boolean {
  if (place.mapVerification?.status !== 'verified' || !isHttpsUrl(place.mapVerification.placeUrl)) return false;
  try { return new URL(place.mapVerification.placeUrl!).hostname === 'place.map.kakao.com'; } catch { return false; }
}

export function getPlacePreviewKind(place: CourseV1DisplayPlace, imageFailed: boolean): PlacePreviewKind {
  if (!imageFailed && isHttpsUrl(place.imageUrl)) {
    return { kind: 'image', sourceLabel: place.imageSource === 'tourapi' ? 'TourAPI 제공 사진' : '부산시 공식 사진' };
  }
  return { kind: 'placeholder' };
}

/** 검증 URL은 최우선이고, 그 외에는 카탈로그 주소 검색 또는 좌표 지도 보기만 쓴다. */
export function buildKakaoPlaceUrl(place: CourseV1DisplayPlace): string | null {
  if (isVerifiedKakaoPlaceUrl(place)) return place.mapVerification!.placeUrl!;
  return buildKakaoPlaceSearchUrl(place);
}

/** 빈 값·광역 행정구역만으로는 장소를 검색하지 않는다. 원천 주소를 추정·보정하지 않는다. */
export function hasDetailedKakaoSearchAddress(addr1: string | null | undefined): boolean {
  const parts = addr1?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length < 3) return false;
  return !parts.every((part) => /(?:광역시|특별시|특별자치시|도|시|군|구)$/.test(part));
}

/** 주소는 검색어 하나로만 사용하고, 넓거나 없는 주소는 좌표 지도 보기로 전환한다. */
export function buildKakaoPlaceSearchUrl(place: CourseV1DisplayPlace): string | null {
  const addr1 = place.addr1?.trim();
  if (hasDetailedKakaoSearchAddress(addr1)) return `https://map.kakao.com/link/search/${encodeURIComponent(addr1!)}`;
  if (!place.title || !hasValidCoordinates(place)) return null;
  return `https://map.kakao.com/link/map/${encodeURIComponent(place.title)},${place.lat},${place.lon}`;
}

function hasValidCoordinates(place: CourseV1DisplayPlace): boolean {
  return Number.isFinite(place.lat) && Number.isFinite(place.lon) && Math.abs(place.lat) <= 90 && Math.abs(place.lon) <= 180;
}

/** 설치된 카카오맵 앱에만 전달할 공식 scheme. Place ID는 verified 숫자 값만 쓴다. */
export function buildKakaoMapAppUrl(place: CourseV1DisplayPlace): string | null {
  const placeId = place.mapVerification?.placeId;
  if (place.mapVerification?.status === 'verified' && typeof placeId === 'string' && /^\d+$/.test(placeId)) return `kakaomap://place?id=${placeId}`;
  if (!hasValidCoordinates(place)) return null;
  return `kakaomap://look?p=${place.lat},${place.lon}`;
}

export async function openKakaoPlace(place: CourseV1DisplayPlace, openUrl: (url: string) => Promise<unknown>): Promise<'opened' | 'failed'> {
  const url = buildKakaoPlaceUrl(place);
  if (!url) return 'failed';
  try { await openUrl(url); return 'opened'; } catch { return 'failed'; }
}

export type KakaoPlaceOpenResult = 'external_opened' | 'browser_fallback_opened' | 'failed' | 'unavailable';
export type KakaoMapDeepLinkOpenResult = 'app_opened' | KakaoPlaceOpenResult;

/** 앱 외부 전환이 거부될 때만 시스템 브라우저 시트로 검색 URL을 한 번 연다. */
export async function openKakaoPlaceWithBrowserFallback(place: CourseV1DisplayPlace, ports: { openExternal: (url: string) => Promise<unknown>; openBrowser: (url: string) => Promise<unknown> }): Promise<KakaoPlaceOpenResult> {
  const externalUrl = buildKakaoPlaceUrl(place);
  if (!externalUrl) return 'unavailable';
  try {
    await ports.openExternal(externalUrl);
    return 'external_opened';
  } catch {
    const browserUrl = buildKakaoPlaceSearchUrl(place);
    if (!browserUrl) return 'failed';
    try { await ports.openBrowser(browserUrl); return 'browser_fallback_opened'; } catch { return 'failed'; }
  }
}

/** 앱 설치 여부를 먼저 확인하고, 실패·미설치 때만 기존 HTTPS/browser fallback을 정확히 한 번 사용한다. */
export async function openKakaoPlaceWithAppFallback(place: CourseV1DisplayPlace, ports: { canOpenApp: (url: string) => Promise<boolean>; openApp: (url: string) => Promise<unknown>; openExternal: (url: string) => Promise<unknown>; openBrowser: (url: string) => Promise<unknown> }): Promise<KakaoMapDeepLinkOpenResult> {
  const appUrl = buildKakaoMapAppUrl(place);
  if (appUrl) {
    try {
      if (await ports.canOpenApp(appUrl)) {
        try { await ports.openApp(appUrl); return 'app_opened'; } catch { /* HTTPS fallback below */ }
      }
    } catch { /* HTTPS fallback below */ }
  }
  return openKakaoPlaceWithBrowserFallback(place, ports);
}
