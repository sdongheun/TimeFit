import type { KakaoLocationSearchResult, LocationSuggestion } from '../services/kakaoLocationSearchAdapter';

export type DraftPlace = { label: string; lat: number; lon: number; source: 'device' | 'provider' };
type SearchStatus = 'idle' | 'loading' | 'success' | 'failure';
type Request = { epoch: number; id: number; target: string; kind: 'search' | 'gps' };
type Draft = {
  epoch: number; target: string; phase: 'closed' | 'search' | 'map'; query: string;
  suggestions: LocationSuggestion[]; selectedId: string | null; deviceLocation: DraftPlace | null;
  searchStatus: SearchStatus; busy: '' | 'search' | 'gps'; message: string; scrollY: number;
};
const empty = (epoch = 0, target = ''): Draft => ({ epoch, target, phase: 'closed', query: '', suggestions: [], selectedId: null, deviceLocation: null, searchStatus: 'idle', busy: '', message: '장소 이름으로 검색하세요', scrollY: 0 });
export const locationCandidateId = (p: LocationSuggestion) => JSON.stringify([p.provider, p.kind, p.label, p.lat, p.lon, p.address]);

/** Ephemeral UI editing session only; no provider cache, location persistence or parent confirmation. */
export function createLocationSearchDraft() {
  let state = empty(), requestId = 0, confirmed = false;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<Draft>) => { state = { ...state, ...patch }; listeners.forEach(fn => fn()); };
  const choice = (): DraftPlace | null => {
    if (state.deviceLocation) return state.deviceLocation;
    const p = state.suggestions.find(p => locationCandidateId(p) === state.selectedId);
    return p ? { label: p.label, lat: p.lat, lon: p.lon, source: 'provider' } : null;
  };
  const current = (r: Request) => state.phase === 'search' && r.epoch === state.epoch && r.target === state.target && r.id === requestId && state.busy === r.kind;
  const cancelPending = () => {
    requestId++;
    update({ busy: '', ...(state.searchStatus === 'loading' ? { searchStatus: 'failure' as const, message: '검색을 다시 실행해 주세요' } : {}) });
  };
  return {
    get: () => state, choice, current,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    start(target: string) { requestId++; confirmed = false; state = { ...empty(state.epoch + 1, target), phase: 'search' }; update({}); },
    end() { requestId++; confirmed = true; state = empty(state.epoch + 1); update({}); },
    pause() { cancelPending(); update({ phase: 'map' }); },
    resume() { if (state.phase === 'map') update({ phase: 'search' }); },
    changeQuery(query: string) {
      if (state.phase !== 'search' || query === state.query) return;
      if (query.trim() === state.query.trim()) { update({ query }); return; }
      requestId++;
      update({ query, suggestions: [], selectedId: null, deviceLocation: null, searchStatus: 'idle', busy: '', scrollY: 0, message: query.trim() ? '검색 버튼을 눌러 장소를 찾으세요' : '장소 이름으로 검색하세요' });
    },
    beginSearch(explicit: boolean): Request | null {
      if (explicit && state.busy === 'gps') cancelPending();
      if (state.phase !== 'search' || !state.query.trim() || state.searchStatus === 'loading' || state.searchStatus === 'success') return null;
      if (!explicit && (state.searchStatus === 'failure' || state.busy === 'gps' || choice())) return null;
      const r: Request = { epoch: state.epoch, id: ++requestId, target: state.target, kind: 'search' };
      update({ busy: 'search', searchStatus: 'loading', message: '검색 중…' }); return r;
    },
    resolveSearch(r: Request, result: KakaoLocationSearchResult) {
      if (!current(r)) return false;
      const success = result.suggestions.length > 0 || result.attempts.every(a => a.status === 'ok');
      update({ busy: '', searchStatus: success ? 'success' : 'failure', suggestions: result.suggestions, message: result.suggestions.length ? '목록에서 위치를 선택하세요' : success ? '장소 또는 주소 결과가 없어요' : '위치 검색을 준비하지 못했어요. 다시 검색해 주세요.' });
      return true;
    },
    fail(r: Request, message: string) { if (current(r)) update({ busy: '', ...(r.kind === 'search' ? { searchStatus: 'failure' as const } : {}), message }); },
    select(id: string) {
      if (state.phase !== 'search' || !state.suggestions.some(p => locationCandidateId(p) === id)) return false;
      cancelPending(); update({ selectedId: id, deviceLocation: null, message: '' }); return true;
    },
    beginGps(): Request | null {
      if (state.phase !== 'search' || state.busy === 'gps') return null;
      cancelPending();
      const r: Request = { epoch: state.epoch, id: ++requestId, target: state.target, kind: 'gps' };
      update({ busy: 'gps', message: '현재 위치 확인 중…' }); return r;
    },
    resolveGps(r: Request, point: { lat: number; lon: number }, label = '현위치') {
      if (!current(r)) return;
      update({ busy: '', query: label, searchStatus: 'success', suggestions: [], scrollY: 0, selectedId: null, deviceLocation: { ...point, label, source: 'device' }, message: label === '현위치' ? '주소를 확인하지 못했어요. 현위치 좌표로 확정하거나 검색·지도로 선택하세요.' : '' });
    },
    claimConfirmation(epoch = state.epoch) {
      const selected = choice();
      if (epoch !== state.epoch || state.phase !== 'search' || confirmed || !selected) return null;
      confirmed = true; requestId++; return selected;
    },
    rememberScroll(y: number) { if (state.phase === 'search') state = { ...state, scrollY: Math.max(0, y) }; },
  };
}
export type LocationSearchDraft = ReturnType<typeof createLocationSearchDraft>;

/** Move only enough to reveal the selected row after footer/keyboard changes. */
export function selectedRowScrollOffset(scrollY: number, viewport: number, row: { y: number; height: number } | undefined) {
  if (!row || viewport <= 0) return scrollY;
  if (row.y < scrollY || row.height > viewport) return Math.max(0, row.y);
  if (row.y + row.height > scrollY + viewport) return Math.max(0, row.y + row.height - viewport);
  return scrollY;
}
