export type RouteLocation = { label: string; lat: number; lon: number };
export type RouteSetupState = { origin: RouteLocation | null; destination: RouteLocation | null; activeField: 'origin' | 'destination' };

export const initialRouteSetupState: RouteSetupState = { origin: null, destination: null, activeField: 'origin' };

export function openRouteField(state: RouteSetupState, activeField: RouteSetupState['activeField']): RouteSetupState {
  return { ...state, activeField };
}

export function applyRouteLocation(state: RouteSetupState, location: RouteLocation): RouteSetupState {
  return state.activeField === 'origin' ? { ...state, origin: location } : { ...state, destination: location };
}

export function routeSetupSummary(state: RouteSetupState): string | null {
  if (!state.origin) return null;
  return state.destination ? `${state.origin.label} → ${state.destination.label}` : `${state.origin.label} · 출발지로 돌아오기`;
}

export function canApplyRouteSetup(state: RouteSetupState): boolean { return state.origin !== null; }
