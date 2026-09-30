import type { LiveNearbyReadModel } from '../data/liveNearbyReadModel';
import type { buildApprovedLiveMultiSourceInput } from '../data/liveSessionBridge';
import type { createSupabaseLiveMultiSourceFacade } from '../services/liveMultiSourceSupabaseProduction';
import type { NearbyCatalogPlace } from './nearbyBrowseModel';
import { reviewedPlacePhotoCompatibility } from './reviewedPlacePhotoCompatibility';
import { placeDisplayTitle } from './placeDisplayTitle';

type FacadeResult = Awaited<ReturnType<typeof createSupabaseLiveMultiSourceFacade>>;
export type NearbyLivePorts = Readonly<{
  createFacade: () => Promise<FacadeResult>;
  buildApprovedInput: typeof buildApprovedLiveMultiSourceInput;
  project: (initial: Parameters<typeof import('../data/liveNearbyReadModel').projectLiveNearbyReadModel>[0]) => LiveNearbyReadModel;
}>;
export type NearbyLiveResult = Readonly<{ status: 'ready' | 'partial' | 'failed'; catalog: readonly NearbyCatalogPlace[]; staticMarketOnly?: boolean }>;
const failed: NearbyLiveResult = Object.freeze({ status: 'failed', catalog: Object.freeze([]) });

/** Location-free projection; the 3km filter remains the existing pure UI calculation. */
export function nearbyCatalogFromLiveModel(model: LiveNearbyReadModel): readonly NearbyCatalogPlace[] {
  if (model.status === 'unavailable' || !model.liveSourceSnapshotId) return [];
  return Object.freeze(model.candidates.filter((candidate) => candidate.informationOnly
    && candidate.id && candidate.title.trim() && Number.isFinite(candidate.lat) && Number.isFinite(candidate.lon))
    .map((candidate) => {
      const livePhoto = candidate.sourceKind !== 'traditional_market_standard_static'
        && candidate.photoDisposition === 'approved_exact' && candidate.photo
        ? { imageUrl: candidate.photo.url, imageSource: 'busan_official', imageEvidence: { liveApprovedPhoto: candidate.photo } }
        : null;
      const reviewedPhoto = candidate.sourceKind !== 'traditional_market_standard_static'
        ? reviewedPlacePhotoCompatibility(candidate.id)
        : null;
      return Object.freeze({
        contentId: candidate.id,
        title: placeDisplayTitle(candidate.title),
        lat: candidate.lat,
        lon: candidate.lon,
        classification: candidate.classification,
        category: candidate.category,
        subCategory: candidate.subCategory ?? null,
        ...(candidate.sourceKind ? { sourceKind: candidate.sourceKind } : {}),
        ...(candidate.operatingHoursStatus ? { operatingHoursStatus: candidate.operatingHoursStatus } : {}),
        addr1: candidate.address ?? null,
        detailDescription: candidate.description ?? null,
        // The browse read model intentionally has no current-hours claim.
        ...(livePhoto ?? reviewedPhoto ?? {}),
      });
    }));
}

export async function productionNearbyLivePorts(): Promise<NearbyLivePorts> {
  const [production, bridge, nearby] = await Promise.all([
    import('../services/liveMultiSourceSupabaseProduction'),
    import('../data/liveSessionBridge'),
    import('../data/liveNearbyReadModel'),
  ]);
  return { createFacade: production.createSupabaseLiveMultiSourceFacade,
    buildApprovedInput: bridge.buildApprovedLiveMultiSourceInput, project: nearby.projectLiveNearbyReadModel };
}

/** One mounted browse screen owns at most one successful provider snapshot. Explicit retry is failure-only. */
export function createNearbyLiveSessionController(loadPorts: NearbyLivePorts | (() => Promise<NearbyLivePorts>)) {
  let phase: 'idle' | 'loading' | 'ready' | 'failed' | 'closed' = 'idle';
  let generation = 0;
  let current: Promise<NearbyLiveResult> | null = null;
  let result: NearbyLiveResult | null = null;
  let disposeCurrent: (() => void) | null = null;
  const ports = () => typeof loadPorts === 'function' ? loadPorts() : Promise.resolve(loadPorts);
  const stale = (request: number) => phase === 'closed' || request !== generation;

  const begin = () => {
    phase = 'loading';
    const request = ++generation;
    const run = async (): Promise<NearbyLiveResult> => {
      let dispose = () => undefined;
      try {
        const livePorts = await ports();
        if (stale(request)) return failed;
        const created = await livePorts.createFacade();
        if (created.status !== 'ready') throw new Error('nearby_live_unavailable');
        let disposed = false;
        dispose = () => {
          if (disposed) return;
          disposed = true;
          created.facade.cancel();
          created.facade.close();
        };
        if (stale(request)) { dispose(); return failed; }
        disposeCurrent = dispose;
        const initial = await created.facade.initialize(livePorts.buildApprovedInput());
        if (stale(request)) { dispose(); return failed; }
        if (initial.status !== 'active') throw new Error('nearby_live_unavailable');
        const projection = livePorts.project(initial);
        if (projection.status === 'unavailable' || !projection.liveSourceSnapshotId) throw new Error('nearby_live_unavailable');
        const catalog = nearbyCatalogFromLiveModel(projection);
        const next: NearbyLiveResult = Object.freeze({ status: projection.status, catalog,
          staticMarketOnly: projection.status === 'partial' && catalog.length > 0
            && catalog.every((place) => place.sourceKind === 'traditional_market_standard_static') });
        result = next;
        phase = 'ready';
        return next;
      } catch {
        dispose();
        if (phase !== 'closed' && request === generation) { result = failed; phase = 'failed'; }
        return failed;
      }
    };
    current = run();
    return current;
  };
  return Object.freeze({
    load(): Promise<NearbyLiveResult> {
      if (phase === 'closed') return Promise.resolve(failed);
      if (current) return current;
      return begin();
    },
    retry(): Promise<NearbyLiveResult> {
      if (phase === 'closed') return Promise.resolve(failed);
      if (phase !== 'failed') return current ?? Promise.resolve(result ?? failed);
      current = null;
      result = null;
      return begin();
    },
    cancel(): void {
      if (phase === 'closed') return;
      phase = 'closed';
      generation += 1;
      disposeCurrent?.();
      disposeCurrent = null;
      result = null;
      current = null;
    },
  });
}
