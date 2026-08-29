import type { LatLon } from '../engine';

export type PickerTarget = 'origin' | 'destination';

/** 출발지는 확정 출발지를, 도착지는 실제 기기 위치를 우선해 지도를 연다. */
export function pickerInitialCenter(target: PickerTarget, origin: LatLon | null, device: LatLon | null, fallback: LatLon): LatLon {
  if (target === 'destination') return device ?? origin ?? fallback;
  return origin ?? device ?? fallback;
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
