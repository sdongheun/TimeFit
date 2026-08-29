import type { LatLon } from '../engine';

export type MapPinReverseResult = { status: 'ok' | 'unconfigured' | 'http_error' | 'network_error' | 'invalid_response'; address?: string };
export type MapPinConfirmationState = { point: LatLon; pointVersion: number; confirming: boolean; message: string; confirmed: { point: LatLon; label: string } | null };

export function createMapPinConfirmationController(initialPoint: LatLon, reverse: (point: LatLon) => Promise<MapPinReverseResult>) {
  let state: MapPinConfirmationState = { point: initialPoint, pointVersion: 0, confirming: false, message: '', confirmed: null };
  const move = (point: LatLon) => { state = { ...state, point, pointVersion: state.pointVersion + 1, message: '' }; };
  const confirm = async () => {
    if (state.confirming) return state;
    const point = state.point, version = state.pointVersion;
    state = { ...state, confirming: true, message: '' };
    const result = await reverse(point);
    if (version !== state.pointVersion) { state = { ...state, confirming: false }; return state; }
    if (result.address) state = { ...state, confirming: false, confirmed: { point, label: result.address } };
    else state = { ...state, confirming: false, message: '주소를 확인하지 못했어요. 좌표로 선택하거나 검색으로 선택하세요.' };
    return state;
  };
  const confirmCoordinate = () => { state = { ...state, confirmed: { point: state.point, label: `지도 선택 위치 (${state.point.lat.toFixed(4)}, ${state.point.lon.toFixed(4)})` } }; return state; };
  return { get state() { return state; }, move, confirm, confirmCoordinate };
}
