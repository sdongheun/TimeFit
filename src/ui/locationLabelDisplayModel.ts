import type { KakaoLocationLabelResult } from '../services/kakaoLocationLabelAdapter';

export function displayLocationLabel(result: Pick<KakaoLocationLabelResult, 'source' | 'address'>, fallback = '현재 위치'): string {
  if (result.source === 'address' && result.address) return result.address;
  if (result.source === 'region' && result.address) return `${result.address} 인근`;
  return fallback;
}

export function applyLatestLocationLabel(currentRequest: number, responseRequest: number, result: Pick<KakaoLocationLabelResult, 'source' | 'address'>): string | null {
  return currentRequest === responseRequest ? displayLocationLabel(result) : null;
}
