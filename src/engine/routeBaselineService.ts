import type { RouteBaseline } from "./actualRouteSearchScope";
import type { LatLon, Mode } from "./types";

export const ROUTE_BASELINE_TTL_MS = 24 * 60 * 60 * 1000;
const BASELINE_MODES: readonly Mode[] = ["walk", "car", "transit"];

export type RouteBaselineFetcher = {
  fetch(origin: LatLon, destination: LatLon, mode: Mode): Promise<RouteBaseline | null>;
};

export type RouteBaselineStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type RouteBaselineResult = {
  baselines: RouteBaseline[];
  status: "all_success" | "partial_success" | "unavailable";
  source: "network" | "memory" | "persistent" | "mixed";
};

type StoredBaseline = {
  mode: Mode;
  geometry: LatLon[];
  fetchedAt: number;
};

type StoredBaselines = {
  version: 1;
  routes: Partial<Record<Mode, StoredBaseline>>;
};

type MemoryEntry = {
  routes: Partial<Record<Mode, StoredBaseline>>;
};

export function createRouteBaselineService(options: {
  fetcher: RouteBaselineFetcher;
  storage?: RouteBaselineStorage;
  now?: () => number;
  namespace?: string;
}) {
  const memory = new Map<string, MemoryEntry>();
  const inFlight = new Map<string, Promise<RouteBaselineResult>>();
  const now = options.now ?? Date.now;
  const namespace = options.namespace ?? "timefit:route-baselines:v1";

  async function get(origin: LatLon, destination: LatLon): Promise<RouteBaselineResult> {
    const key = routeBaselineKey(namespace, origin, destination);
    const current = inFlight.get(key);
    if (current) return current;

    const request = loadAndFetch(key, origin, destination).finally(() => inFlight.delete(key));
    inFlight.set(key, request);
    return request;
  }

  async function loadAndFetch(key: string, origin: LatLon, destination: LatLon): Promise<RouteBaselineResult> {
    const nowMs = now();
    let routes = memory.get(key)?.routes;
    let source: RouteBaselineResult["source"] = routes ? "memory" : "network";

    if (!routes) {
      const loaded = await loadPersistent(key, nowMs);
      if (loaded) {
        routes = loaded;
        source = "persistent";
      } else {
        routes = {};
      }
      memory.set(key, { routes });
    }

    const missingModes = BASELINE_MODES.filter((mode) => !isFresh(routes?.[mode], nowMs));
    if (missingModes.length > 0) {
      const fetched = await Promise.all(missingModes.map(async (mode) => {
        const route = await options.fetcher.fetch(origin, destination, mode);
        return route && isUsable(route) ? { mode, route } : null;
      }));
      let wrote = false;
      for (const item of fetched) {
        if (!item || !routes) continue;
        routes[item.mode] = { mode: item.mode, geometry: [...item.route.geometry], fetchedAt: nowMs };
        wrote = true;
      }
      if (wrote && routes) await savePersistent(key, routes);
      source = source === "network" ? "network" : "mixed";
    }

    const baselines = BASELINE_MODES.flatMap((mode) => {
      const stored = routes?.[mode];
      return stored && isFresh(stored, now()) ? [{ mode, geometry: stored.geometry }] : [];
    });
    return {
      baselines,
      status: baselines.length === 3 ? "all_success" : baselines.length > 0 ? "partial_success" : "unavailable",
      source,
    };
  }

  async function loadPersistent(key: string, nowMs: number): Promise<Partial<Record<Mode, StoredBaseline>> | null> {
    if (!options.storage) return null;
    try {
      const raw = await options.storage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredBaselines;
      if (parsed?.version !== 1 || !parsed.routes) return null;
      const routes = Object.fromEntries(
        BASELINE_MODES
          .map((mode) => [mode, parsed.routes[mode]] as const)
          .filter(([, route]) => isFresh(route, nowMs)),
      ) as Partial<Record<Mode, StoredBaseline>>;
      if (Object.keys(routes).length === 0) {
        await options.storage.removeItem(key);
        return null;
      }
      return routes;
    } catch {
      return null;
    }
  }

  async function savePersistent(key: string, routes: Partial<Record<Mode, StoredBaseline>>): Promise<void> {
    if (!options.storage) return;
    try {
      await options.storage.setItem(key, JSON.stringify({ version: 1, routes } satisfies StoredBaselines));
    } catch {
      // 저장소 오류는 기준 경로 조회를 막지 않는다. 현재 런타임 메모리 캐시만 사용한다.
    }
  }

  return { get };
}

export function routeBaselineKey(namespace: string, origin: LatLon, destination: LatLon): string {
  const point = (value: LatLon) => `${value.lat.toFixed(5)},${value.lon.toFixed(5)}`;
  return `${namespace}:${point(origin)}:${point(destination)}`;
}

function isFresh(route: StoredBaseline | undefined, nowMs: number): route is StoredBaseline {
  return !!route && nowMs - route.fetchedAt >= 0 && nowMs - route.fetchedAt < ROUTE_BASELINE_TTL_MS && isUsable(route);
}

function isUsable(route: Pick<RouteBaseline, "geometry">): boolean {
  return route.geometry.length >= 2 && route.geometry.every((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));
}
