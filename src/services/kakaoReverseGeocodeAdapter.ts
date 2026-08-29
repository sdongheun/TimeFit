import {
  kakaoReverseGeocodeResult,
  type KakaoPoiSearchOptions,
  type KakaoReverseGeocodeResult,
} from '../engine/kakao';

export type ReverseGeocodeSelectionResult = KakaoReverseGeocodeResult & {
  labelSource?: 'provider';
  addressSource?: 'provider';
  diagnostics: { providerRequests: { kakao: 0 | 1; tmap: 0 } };
};

/**
 * 지도 핀의 명시적 확정에서만 호출한다. 지도 탭·이동·드래그는 이 함수를 호출하지 않는 UI 책임이다.
 * 재시도·검색 fallback·TMAP 호출 없이 Kakao 역지오코딩 요청 하나만 만든다.
 */
export async function reverseGeocodeSelection(
  lat: number,
  lon: number,
  options: KakaoPoiSearchOptions = {},
): Promise<ReverseGeocodeSelectionResult> {
  const result = await kakaoReverseGeocodeResult(lat, lon, options);
  const providerRequests = { kakao: result.status === 'unconfigured' ? 0 : 1, tmap: 0 } as const;
  return result.address
    ? { ...result, labelSource: 'provider', addressSource: 'provider', diagnostics: { providerRequests } }
    : { ...result, diagnostics: { providerRequests } };
}
