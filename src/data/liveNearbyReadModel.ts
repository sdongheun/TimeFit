import type { BusanLivePhoto, BusanLiveRecord, BusanLiveSourceKey } from '../services/busanLiveAdapter';
import type { LiveMultiSourceFacadeInitial } from '../services/liveMultiSourceSessionFacade';
import { createMultiSourceLiveInputs, type MultiSourceLocalInput, type MultiSourcePartition } from './busanLiveProjection';
import { liveCatalogSourceDistanceMeters, type LiveCatalogProjection } from './liveCatalogProjection';
import { projectLiveSessionInitial } from './liveSessionBridge';
import marketSnapshot from './traditional_market_browse_snapshot.json';

type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
type Provider = 'tourapi' | BusanLiveSourceKey | 'traditional_market_standard';
type ProviderState = 'active' | 'inactive' | 'unavailable' | 'identity_conflict' | 'static_snapshot';
type State = 'active' | 'inactive' | 'review_required' | 'source_unavailable' | 'provider_out_of_scope';
type Reason = 'snapshot_mismatch' | 'identity_conflict' | 'missing_active_fact' | 'busan_internal_conflict'
  | 'traditional_market_provider_out_of_scope' | 'no_live_provider_mapping';

export type LiveNearbyCandidate = DeepReadonly<{
  id: string;
  title: string;
  address?: string;
  lat: number;
  lon: number;
  description?: string;
  photo?: Extract<BusanLivePhoto, { status: 'approved' }>;
  photoDisposition: 'approved_exact' | 'default_no_approved_evidence' | 'default_conflicting_approved_urls';
  classification: MultiSourceLocalInput['place']['policy']['classification'];
  category: string;
  subCategory?: string;
  informationOnly: true;
  sourceKind: 'live' | 'traditional_market_standard_static';
  operatingHoursStatus?: 'unverified';
  provenance: {
    title: readonly Provider[];
    coordinates: readonly Provider[];
    address: readonly Provider[];
    description: readonly Provider[];
    photo: readonly Provider[];
  };
}>;

export type LiveNearbyRecord = DeepReadonly<{
  placeId: string;
  partition: MultiSourcePartition;
  state: State;
  reason?: Reason;
  providers: readonly { provider: Provider; sourceId: string; state: ProviderState }[];
}>;

export type LiveNearbyReadModel = DeepReadonly<{
  status: 'ready' | 'partial' | 'unavailable';
  liveSourceSnapshotId: string | null;
  reason?: 'snapshot_mismatch' | 'invalid_snapshot_context';
  candidates: readonly LiveNearbyCandidate[];
  records: readonly LiveNearbyRecord[];
  summary: {
    runtimePlaces: number;
    liveMappedPlaces: number;
    active: number;
    inactive: number;
    reviewRequired: number;
    sourceUnavailable: number;
    providerOutOfScope: number;
    staticMarketBrowse: number;
  };
}>;

const locals = createMultiSourceLiveInputs();
const marketById = new Map(marketSnapshot.data.map((row) => [row.placeId, row]));
const marketLocals = locals.filter((local) => local.partition === 'traditional_market_only');
if (marketSnapshot.meta.source !== 'traditional_market_standard' || marketLocals.length !== 118
  || marketById.size !== 118 || marketSnapshot.data.length !== 118
  || marketLocals.some((local) => !marketById.has(local.place.id))) {
  throw new Error('traditional market browse snapshot does not match reviewed exact IDs');
}
const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const norm = (value: string) => value.normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/[\p{White_Space}\p{P}\p{S}]/gu, '');
const knownTitle = (local: MultiSourceLocalInput, title: string) => [local.place.identity.title, ...local.place.identity.aliases]
  .some((known) => norm(known) === norm(title));

function frozen<T>(value: T): DeepReadonly<T> {
  const copy = structuredClone(value);
  const freeze = (item: unknown): void => {
    if (item && typeof item === 'object' && !Object.isFrozen(item)) {
      Object.values(item).forEach(freeze);
      Object.freeze(item);
    }
  };
  freeze(copy);
  return copy as DeepReadonly<T>;
}

function busanIdentityConflict(local: MultiSourceLocalInput, record: BusanLiveRecord): boolean {
  return !knownTitle(local, record.title)
    && liveCatalogSourceDistanceMeters(local.place.identity, record) >= 1000;
}

function busanInternalConflict(records: readonly BusanLiveRecord[]): boolean {
  if (records.length <= 1) return false;
  const first = records[0];
  return records.some((record) => norm(record.title) !== norm(first.title)
    || record.lat !== first.lat || record.lon !== first.lon
    || norm(record.address ?? '') !== norm(first.address ?? '')
    || norm(record.description ?? '') !== norm(first.description ?? ''));
}

function finish(
  status: LiveNearbyReadModel['status'],
  snapshotId: string | null,
  candidates: readonly LiveNearbyCandidate[],
  records: readonly LiveNearbyRecord[],
  reason?: LiveNearbyReadModel['reason'],
): LiveNearbyReadModel {
  const sortedRecords = [...records].sort((left, right) => compare(left.placeId, right.placeId));
  const sortedCandidates = [...candidates].sort((left, right) => compare(left.id, right.id));
  return frozen({ status, liveSourceSnapshotId: snapshotId, ...(reason ? { reason } : {}), candidates: sortedCandidates,
    records: sortedRecords, summary: {
      runtimePlaces: sortedRecords.length,
      liveMappedPlaces: sortedRecords.filter((record) => record.partition !== 'traditional_market_only' && record.partition !== 'other').length,
      active: sortedRecords.filter((record) => record.state === 'active').length,
      inactive: sortedRecords.filter((record) => record.state === 'inactive').length,
      reviewRequired: sortedRecords.filter((record) => record.state === 'review_required').length,
      sourceUnavailable: sortedRecords.filter((record) => record.state === 'source_unavailable').length,
      providerOutOfScope: sortedRecords.filter((record) => record.state === 'provider_out_of_scope').length,
      staticMarketBrowse: sortedCandidates.filter((candidate) => candidate.sourceKind === 'traditional_market_standard_static').length,
    } });
}

/** Pure, memory-only browse view over one facade snapshot. No clock, location, route, detail, or persistence. */
export function projectLiveNearbyReadModel(initial: LiveMultiSourceFacadeInitial): LiveNearbyReadModel {
  const projected = projectLiveSessionInitial(initial);
  if (projected.status === 'rejected') {
    return finish('unavailable', null, [], locals.map((local) => local.partition === 'traditional_market_only' || local.partition === 'other'
      ? { placeId: local.place.id, partition: local.partition, state: 'provider_out_of_scope',
        reason: local.partition === 'traditional_market_only' ? 'traditional_market_provider_out_of_scope' : 'no_live_provider_mapping', providers: [] }
      : { placeId: local.place.id, partition: local.partition, state: 'review_required', reason: 'snapshot_mismatch', providers: [] }), projected.reason);
  }
  const { tour, busan } = projected.sources;
  const snapshotId = initial.snapshotContext.liveSourceSnapshotId;
  const tourCandidateById = new Map(tour.candidates.map((candidate) => [candidate.id, candidate]));
  const tourRecordById = new Map(tour.records.map((record) => [record.placeId, record]));
  const candidates: LiveNearbyCandidate[] = [];
  const records: LiveNearbyRecord[] = [];

  for (const local of locals) {
    if (local.partition === 'traditional_market_only') {
      const market = marketById.get(local.place.id)!;
      records.push({ placeId: local.place.id, partition: local.partition, state: 'active',
        providers: [{ provider: 'traditional_market_standard', sourceId: market.sourceId, state: 'static_snapshot' }] });
      candidates.push({ id: local.place.id, title: market.title, address: market.address,
        lat: market.lat, lon: market.lon, photoDisposition: 'default_no_approved_evidence',
        classification: local.place.policy.classification, category: local.place.policy.category,
        ...(local.place.policy.subCategory ? { subCategory: local.place.policy.subCategory } : {}),
        informationOnly: true, sourceKind: 'traditional_market_standard_static', operatingHoursStatus: 'unverified',
        provenance: { title: ['traditional_market_standard'], coordinates: ['traditional_market_standard'],
          address: ['traditional_market_standard'], description: [], photo: [] } });
      continue;
    }
    if (local.partition === 'other') {
      records.push({ placeId: local.place.id, partition: local.partition, state: 'provider_out_of_scope',
        reason: 'no_live_provider_mapping', providers: [] });
      continue;
    }
    const providers: { provider: Provider; sourceId: string; state: ProviderState }[] = [];
    const activeBusan: BusanLiveRecord[] = [];
    const tourCandidate = tourCandidateById.get(local.place.id);
    if (local.tourapiSourceId) {
      const state = tourRecordById.get(local.place.id)?.state;
      providers.push({ provider: 'tourapi', sourceId: local.tourapiSourceId,
        state: state === 'active_catalog' && tourCandidate ? 'active'
          : state === 'inactive' ? 'inactive'
            : state === 'identity_conflict' ? 'identity_conflict' : 'unavailable' });
    }
    for (const mapping of local.busanMappings) {
      const source = 'sources' in busan ? busan.sources[mapping.source] : undefined;
      let state: ProviderState = 'unavailable';
      if (source?.status === 'ready') {
        if (source.inactiveApprovedSourceIds.includes(mapping.sourceId)) state = 'inactive';
        else if (source.activeApprovedSourceIds.includes(mapping.sourceId)) {
          const row = source.records.find((record) => record.sourceId === mapping.sourceId);
          if (!row) state = 'identity_conflict';
          else if (busanIdentityConflict(local, row)) state = 'identity_conflict';
          else { state = 'active'; activeBusan.push(row); }
        } else state = 'identity_conflict';
      }
      providers.push({ provider: mapping.source, sourceId: mapping.sourceId, state });
    }
    const states = providers.map((provider) => provider.state);
    let state: State;
    let reason: Reason | undefined;
    if (states.includes('identity_conflict')) { state = 'review_required'; reason = 'identity_conflict'; }
    else if (busanInternalConflict(activeBusan)) { state = 'review_required'; reason = 'busan_internal_conflict'; }
    else if (states.every((value) => value === 'inactive')) state = 'inactive';
    else if (!states.includes('active')) state = 'source_unavailable';
    else if (providers.some((provider) => provider.provider === 'tourapi' && provider.state === 'active') && !tourCandidate) {
      state = 'review_required'; reason = 'missing_active_fact';
    } else if (activeBusan.length === 0 && !tourCandidate) {
      state = 'review_required'; reason = 'missing_active_fact';
    } else state = 'active';
    records.push({ placeId: local.place.id, partition: local.partition, state, ...(reason ? { reason } : {}), providers });
    if (state !== 'active') continue;

    const busanOwner = activeBusan[0];
    const title = tourCandidate?.facts.title ?? busanOwner.title;
    const lat = tourCandidate?.facts.lat ?? busanOwner.lat;
    const lon = tourCandidate?.facts.lon ?? busanOwner.lon;
    const address = tourCandidate?.facts.address ?? busanOwner?.address;
    const description = busanOwner?.description;
    const approvedPhotos = activeBusan.flatMap((record) => record.photo.status === 'approved' ? [record.photo] : []);
    const urls = new Set(approvedPhotos.map((photo) => photo.url));
    const photo = urls.size === 1 ? approvedPhotos[0] : undefined;
    const titleOwner = tourCandidate ? 'tourapi' as const : busanOwner.source;
    const addressOwner = tourCandidate?.facts.address ? 'tourapi' as const : busanOwner?.address ? busanOwner.source : undefined;
    candidates.push({ id: local.place.id, title, lat, lon, ...(address ? { address } : {}),
      ...(description ? { description } : {}), ...(photo ? { photo } : {}),
      photoDisposition: photo ? 'approved_exact' : urls.size > 1 ? 'default_conflicting_approved_urls' : 'default_no_approved_evidence',
      classification: local.place.policy.classification,
      category: local.place.policy.category,
      ...(local.place.policy.subCategory ? { subCategory: local.place.policy.subCategory } : {}),
      informationOnly: true,
      sourceKind: 'live',
      provenance: { title: [titleOwner], coordinates: [titleOwner], address: addressOwner ? [addressOwner] : [],
        description: description && busanOwner ? [busanOwner.source] : [], photo: photo ? activeBusan.filter((record) => record.photo.status === 'approved' && record.photo.url === photo.url).map((record) => record.source).sort(compare) : [] },
    });
  }
  const status = tour.status !== 'ready' || busan.status !== 'ready' || records.some((record) => record.state === 'review_required' || record.state === 'source_unavailable') ? 'partial' : 'ready';
  return finish(status, snapshotId, candidates, records);
}
