import type { LatLon } from '../engine';

export type PickerTarget = 'origin' | 'destination';

/** Existing selected field first; a default camera view never confirms a selection. */
export function pickerInitialCenter(target: PickerTarget, origin: LatLon | null, destination: LatLon | null, fallback: LatLon): LatLon {
  if (target === 'destination') return destination ?? origin ?? fallback;
  return origin ?? fallback;
}

export type MapPickerStatus = 'loading' | 'ready' | 'failed';

export function mapPickerStatus(event: 'open' | 'ready' | 'error' | 'retry'): MapPickerStatus {
  if (event === 'ready') return 'ready';
  if (event === 'error') return 'failed';
  return 'loading';
}

export function canConfirmMapPoint(status: MapPickerStatus, confirming: boolean): boolean {
  return status === 'ready' && !confirming;
}

/** origin 렌더 갱신은 취소 사유가 아니며, 화면 이탈·명시 선택만 요청을 무효화한다. */
export function shouldApplyGpsLabel(routeSetupActive: boolean, responseRequest: number, currentRequest: number): boolean {
  return routeSetupActive && responseRequest === currentRequest;
}

/** 하나의 주입 adapter를 GPS 자동 라벨과 지도 핀 확정에 함께 전달한다. */
export function sharedLocationLabelAdapter<T>(adapter: T): { gps: T; pin: T } {
  return { gps: adapter, pin: adapter };
}
