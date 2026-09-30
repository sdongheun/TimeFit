import type { SafeTourLiveFailure, TourLiveCatalogPlace, TourLiveCatalogSnapshot } from '../services/tourApiLiveAdapter';
import runtimeCatalog from './busan_poi_catalog.json';

type RuntimePlace = (typeof runtimeCatalog.matched.data)[number] | (typeof runtimeCatalog.unmatched.data)[number];
type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;

export type LiveCatalogClassification = 'representative_core' | 'representative_standard' | 'conditional_more' | 'hold';
export type LiveCatalogProviderScope = 'tourapi' | 'traditional_market_only' | 'other_provider';
export type LiveCatalogProjectionState = 'active_catalog' | 'inactive' | 'identity_conflict' | 'provider_out_of_scope' | 'source_unavailable';
export type LiveCatalogConflictReason =
  | 'content_type_changed'
  | 'compound_identity_change'
  | 'missing_live_common_fact'
  | 'invalid_live_common_fact'
  | 'ambiguous_mapping'
  | 'missing_source_state'
  | 'provider_identity_conflict';

export type LocalLiveCatalogPlace = Readonly<{
  id: string;
  order: number;
  providerScope: LiveCatalogProviderScope;
  mapping?: Readonly<{ contentId: string; contentTypeId: string }>;
  identity: Readonly<{ title: string; aliases: readonly string[]; lat: number; lon: number }>;
  policy: Readonly<{
    category: string;
    subCategory?: string;
    classification: LiveCatalogClassification;
    availabilityProfile: string;
    activityType: string;
    minStayMin: number;
    recommendedStayMin: number;
    maxStayMin: number;
    discoveryEligibility?: string;
    evidenceReviewDueAt: string;
  }>;
  relations: Readonly<{
    siteGroupId?: string;
    siteRole?: string;
    mergedPlaceIds: readonly string[];
  }>;
}>;

export type LiveCatalogProjectedCandidate = DeepReadonly<{
  id: string;
  order: number;
  source: { provider: 'tourapi'; contentId: string; contentTypeId: string };
  state: 'active_catalog';
  facts: { title: string; address?: string; lat: number; lon: number; modifiedAt?: string };
  provenance: Partial<Record<'title' | 'address' | 'lat' | 'lon' | 'modifiedAt', 'tourapi_live_catalog'>>;
  policy: LocalLiveCatalogPlace['policy'];
  relations: LocalLiveCatalogPlace['relations'];
}>;

export type LiveCatalogProjectionRecord = Readonly<{
  placeId: string;
  providerScope: LiveCatalogProviderScope;
  sourceContentId?: string;
  sourceContentTypeId?: string;
  state: LiveCatalogProjectionState;
  reason?: LiveCatalogConflictReason | 'not_tourapi_mapped' | 'traditional_market_provider_out_of_scope';
}>;

export type LiveCatalogProjection = DeepReadonly<{
  status: 'ready' | 'partial' | 'unavailable';
  liveSourceSnapshotId: string | null;
  fetchedAt: string | null;
  candidates: readonly LiveCatalogProjectedCandidate[];
  records: readonly LiveCatalogProjectionRecord[];
  unreviewedSourceCount: number;
  summary: {
    runtimePlaces: number;
    tourapiMapped: number;
    activeCatalog: number;
    inactive: number;
    identityConflict: number;
    providerOutOfScope: number;
    traditionalMarketOnly: number;
  };
}>;

/** Token-free structural input accepted from the session facade. */
export type TourLiveCatalogProjectionSource =
  | Readonly<{ kind: 'catalog'; status: 'ready'; snapshot: TourLiveCatalogSnapshot }>
  | Readonly<{ kind: 'catalog'; status: 'partial'; snapshot: TourLiveCatalogSnapshot; failures: readonly SafeTourLiveFailure[] }>
  | Readonly<{ status: 'unavailable'; reason: SafeTourLiveFailure }>;

const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const sourceKey = (contentId: string, contentTypeId: string) => `${contentId}:${contentTypeId}`;
const normalizeTitle = (value: string) => value.normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/[\p{White_Space}\p{P}\p{S}]/gu, '');
const validPoint = (value: { lat: number; lon: number }) => Number.isFinite(value.lat) && Number.isFinite(value.lon) && Math.abs(value.lat) <= 90 && Math.abs(value.lon) <= 180;

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

/** Source-coordinate comparison only. User coordinates and route distance never enter this module. */
export function liveCatalogSourceDistanceMeters(left: { lat: number; lon: number }, right: { lat: number; lon: number }): number {
  if (!validPoint(left) || !validPoint(right)) return Number.NaN;
  const radians = Math.PI / 180;
  const h = Math.sin((right.lat - left.lat) * radians / 2) ** 2
    + Math.cos(left.lat * radians) * Math.cos(right.lat * radians) * Math.sin((right.lon - left.lon) * radians / 2) ** 2;
  const meters = 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
  return Math.round(meters * 1e6) / 1e6;
}

function classification(value: string): LiveCatalogClassification {
  if (value === 'representative_core' || value === 'representative_standard' || value === 'conditional_more' || value === 'hold') return value;
  throw new Error(`unknown live catalog classification: ${value}`);
}

function providerScope(place: RuntimePlace): LiveCatalogProviderScope {
  if (place.tourapiContentId && place.tourapiContentTypeId) return 'tourapi';
  const sources = place.sourceEvidence.map((evidence) => evidence.source);
  return sources.length > 0 && sources.every((source) => source === 'traditional_market_standard')
    ? 'traditional_market_only'
    : 'other_provider';
}

function runtimeInput(place: RuntimePlace, order: number): LocalLiveCatalogPlace {
  const scope = providerScope(place);
  const discoveryEligibility = place.discovery?.eligibility;
  return deepFreeze({
    id: place.contentId,
    order,
    providerScope: scope,
    ...(scope === 'tourapi' ? { mapping: { contentId: String(place.tourapiContentId), contentTypeId: String(place.tourapiContentTypeId) } } : {}),
    identity: { title: place.title, aliases: [...place.aliases], lat: place.lat, lon: place.lon },
    policy: {
      category: place.category,
      ...(place.subCategory ? { subCategory: place.subCategory } : {}),
      classification: classification(place.classification),
      availabilityProfile: place.availabilityProfile,
      activityType: place.shortStay.type,
      minStayMin: place.shortStay.minStayMin,
      recommendedStayMin: place.shortStay.recommendedStayMin,
      maxStayMin: place.shortStay.maxStayMin,
      ...(discoveryEligibility ? { discoveryEligibility } : {}),
      evidenceReviewDueAt: place.evidenceProfile.reviewDueAt,
    },
    relations: {
      ...(place.siteGroupId ? { siteGroupId: place.siteGroupId } : {}),
      ...('siteRole' in place && place.siteRole ? { siteRole: String(place.siteRole) } : {}),
      mergedPlaceIds: [...place.mergedPlaceIds],
    },
  });
}

const runtimeInputs = deepFreeze(
  [...runtimeCatalog.matched.data, ...runtimeCatalog.unmatched.data]
    .sort((left, right) => compare(left.contentId, right.contentId))
    .map(runtimeInput),
);

/** Reviewed 369-place policy projection. It intentionally contains no AI-Hub identity or stored source facts. */
export function createRuntimeLiveCatalogInputs(): readonly LocalLiveCatalogPlace[] {
  return runtimeInputs;
}

function liveFactProblem(place: TourLiveCatalogPlace): 'missing_live_common_fact' | 'invalid_live_common_fact' | null {
  const raw = place as unknown as Record<string, unknown>;
  if (!Object.hasOwn(raw, 'title') || !Object.hasOwn(raw, 'lat') || !Object.hasOwn(raw, 'lon')) return 'missing_live_common_fact';
  if (typeof raw.title !== 'string' || !raw.title.trim() || typeof raw.lat !== 'number' || typeof raw.lon !== 'number' || !validPoint({ lat: raw.lat, lon: raw.lon })) return 'invalid_live_common_fact';
  if (Object.hasOwn(raw, 'address') && raw.address !== undefined && typeof raw.address !== 'string') return 'invalid_live_common_fact';
  if (Object.hasOwn(raw, 'modifiedAt') && raw.modifiedAt !== undefined && typeof raw.modifiedAt !== 'string') return 'invalid_live_common_fact';
  return null;
}

function projectedCandidate(local: LocalLiveCatalogPlace, live: TourLiveCatalogPlace): LiveCatalogProjectedCandidate {
  const facts: LiveCatalogProjectedCandidate['facts'] = {
    title: live.title,
    lat: live.lat,
    lon: live.lon,
    ...(Object.hasOwn(live, 'address') ? { address: live.address } : {}),
    ...(Object.hasOwn(live, 'modifiedAt') ? { modifiedAt: live.modifiedAt } : {}),
  };
  const provenance: LiveCatalogProjectedCandidate['provenance'] = {
    title: 'tourapi_live_catalog',
    lat: 'tourapi_live_catalog',
    lon: 'tourapi_live_catalog',
    ...(Object.hasOwn(live, 'address') ? { address: 'tourapi_live_catalog' as const } : {}),
    ...(Object.hasOwn(live, 'modifiedAt') ? { modifiedAt: 'tourapi_live_catalog' as const } : {}),
  };
  return deepFreeze({
    id: local.id,
    order: local.order,
    source: { provider: 'tourapi', contentId: local.mapping!.contentId, contentTypeId: local.mapping!.contentTypeId },
    state: 'active_catalog' as const,
    facts,
    provenance,
    policy: {
      category: local.policy.category,
      ...(local.policy.subCategory ? { subCategory: local.policy.subCategory } : {}),
      classification: local.policy.classification,
      availabilityProfile: local.policy.availabilityProfile,
      activityType: local.policy.activityType,
      minStayMin: local.policy.minStayMin,
      recommendedStayMin: local.policy.recommendedStayMin,
      maxStayMin: local.policy.maxStayMin,
      ...(local.policy.discoveryEligibility ? { discoveryEligibility: local.policy.discoveryEligibility } : {}),
      evidenceReviewDueAt: local.policy.evidenceReviewDueAt,
    },
    relations: {
      ...(local.relations.siteGroupId ? { siteGroupId: local.relations.siteGroupId } : {}),
      ...(local.relations.siteRole ? { siteRole: local.relations.siteRole } : {}),
      mergedPlaceIds: [...local.relations.mergedPlaceIds],
    },
  });
}

/**
 * Pure catalog-stage join. No HTTP, user coordinates, opening-hours detail, ranking, or catalog fallback.
 * Only exact reviewed TourAPI contentId+contentTypeId mappings can become active candidates.
 */
export function projectTourLiveCatalog(
  localPlaces: readonly LocalLiveCatalogPlace[],
  source: TourLiveCatalogProjectionSource,
): LiveCatalogProjection {
  const sorted = [...localPlaces].sort((left, right) => left.order - right.order || compare(left.id, right.id));
  const candidates: LiveCatalogProjectedCandidate[] = [];
  const records: LiveCatalogProjectionRecord[] = [];
  const mapped = sorted.filter((place) => place.providerScope === 'tourapi' && place.mapping);
  const mappingCounts = new Map<string, number>();
  for (const place of mapped) {
    const key = sourceKey(place.mapping!.contentId, place.mapping!.contentTypeId);
    mappingCounts.set(key, (mappingCounts.get(key) ?? 0) + 1);
  }

  const pushRecord = (local: LocalLiveCatalogPlace, state: LiveCatalogProjectionState, reason?: LiveCatalogProjectionRecord['reason']) => {
    records.push({
      placeId: local.id,
      providerScope: local.providerScope,
      ...(local.mapping ? { sourceContentId: local.mapping.contentId, sourceContentTypeId: local.mapping.contentTypeId } : {}),
      state,
      ...(reason ? { reason } : {}),
    });
  };

  if (source.status === 'unavailable') {
    for (const local of sorted) {
      if (local.providerScope === 'tourapi' && local.mapping) pushRecord(local, 'source_unavailable');
      else pushRecord(local, 'provider_out_of_scope', local.providerScope === 'traditional_market_only' ? 'traditional_market_provider_out_of_scope' : 'not_tourapi_mapped');
    }
    return finalize('unavailable', null, null, candidates, records, 0);
  }

  const statesByContentId = new Map<string, typeof source.snapshot.candidateStates>();
  const liveByContentId = new Map<string, typeof source.snapshot.catalogPlaces>();
  for (const state of source.snapshot.candidateStates) statesByContentId.set(state.contentId, [...(statesByContentId.get(state.contentId) ?? []), state]);
  for (const live of source.snapshot.catalogPlaces) liveByContentId.set(live.contentId, [...(liveByContentId.get(live.contentId) ?? []), live]);

  for (const local of sorted) {
    if (local.providerScope !== 'tourapi' || !local.mapping) {
      pushRecord(local, 'provider_out_of_scope', local.providerScope === 'traditional_market_only' ? 'traditional_market_provider_out_of_scope' : 'not_tourapi_mapped');
      continue;
    }
    const mapping = local.mapping;
    const exactKey = sourceKey(mapping.contentId, mapping.contentTypeId);
    if ((mappingCounts.get(exactKey) ?? 0) !== 1 || sorted.filter((place) => place.id === local.id).length !== 1) {
      pushRecord(local, 'identity_conflict', 'ambiguous_mapping');
      continue;
    }
    const states = statesByContentId.get(mapping.contentId) ?? [];
    if (states.length === 0) {
      pushRecord(local, 'identity_conflict', 'missing_source_state');
      continue;
    }
    if (states.length !== 1) {
      pushRecord(local, 'identity_conflict', 'ambiguous_mapping');
      continue;
    }
    const state = states[0];
    if (state.contentTypeId !== mapping.contentTypeId) {
      pushRecord(local, 'identity_conflict', 'content_type_changed');
      continue;
    }
    if (state.state === 'inactive') {
      pushRecord(local, 'inactive');
      continue;
    }
    if (state.state === 'identity_conflict') {
      pushRecord(local, 'identity_conflict', 'provider_identity_conflict');
      continue;
    }
    const liveRows = liveByContentId.get(mapping.contentId) ?? [];
    if (liveRows.length !== 1) {
      pushRecord(local, 'identity_conflict', liveRows.length === 0 ? 'missing_live_common_fact' : 'ambiguous_mapping');
      continue;
    }
    const live = liveRows[0];
    if (live.contentTypeId !== mapping.contentTypeId) {
      pushRecord(local, 'identity_conflict', 'content_type_changed');
      continue;
    }
    const factProblem = liveFactProblem(live);
    if (factProblem) {
      pushRecord(local, 'identity_conflict', factProblem);
      continue;
    }
    const knownTitle = [local.identity.title, ...local.identity.aliases]
      .some((title) => normalizeTitle(title) === normalizeTitle(live.title));
    const distance = liveCatalogSourceDistanceMeters(local.identity, live);
    if (!knownTitle && distance >= 1000) {
      pushRecord(local, 'identity_conflict', 'compound_identity_change');
      continue;
    }
    candidates.push(projectedCandidate(local, live));
    pushRecord(local, 'active_catalog');
  }

  const hasLocalConflict = records.some((record) => record.state === 'identity_conflict');
  return finalize(
    source.status === 'partial' || hasLocalConflict ? 'partial' : 'ready',
    source.snapshot.liveSourceSnapshotId,
    source.snapshot.fetchedAt,
    candidates,
    records,
    source.snapshot.unreviewedCount,
  );
}

function finalize(
  status: LiveCatalogProjection['status'],
  liveSourceSnapshotId: string | null,
  fetchedAt: string | null,
  candidates: readonly LiveCatalogProjectedCandidate[],
  records: readonly LiveCatalogProjectionRecord[],
  unreviewedSourceCount: number,
): LiveCatalogProjection {
  const stableCandidates = [...candidates].sort((left, right) => left.order - right.order || compare(left.id, right.id));
  const stableRecords = [...records].sort((left, right) => compare(left.placeId, right.placeId));
  return deepFreeze({
    status,
    liveSourceSnapshotId,
    fetchedAt,
    candidates: stableCandidates,
    records: stableRecords,
    unreviewedSourceCount,
    summary: {
      runtimePlaces: stableRecords.length,
      tourapiMapped: stableRecords.filter((record) => record.providerScope === 'tourapi').length,
      activeCatalog: stableRecords.filter((record) => record.state === 'active_catalog').length,
      inactive: stableRecords.filter((record) => record.state === 'inactive').length,
      identityConflict: stableRecords.filter((record) => record.state === 'identity_conflict').length,
      providerOutOfScope: stableRecords.filter((record) => record.state === 'provider_out_of_scope').length,
      traditionalMarketOnly: stableRecords.filter((record) => record.reason === 'traditional_market_provider_out_of_scope').length,
    },
  });
}
