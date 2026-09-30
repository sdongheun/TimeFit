import type { StructuredAvailability } from '../engine/courseV1';
import type {
  BusanLivePhoto,
  BusanLiveRecord,
  BusanLiveResult,
  BusanLiveSourceKey,
} from '../services/busanLiveAdapter';
import sourceMapping from '../../data/processed/review/live_source_place_mapping_manifest.json';
import {
  createRuntimeLiveCatalogInputs,
  liveCatalogSourceDistanceMeters,
  type LiveCatalogProjection,
  type LocalLiveCatalogPlace,
} from './liveCatalogProjection';
import {
  normalizeLiveOpeningSourceText,
  type LiveOpeningResult,
} from './liveOpeningNormalizer';
import {
  normalizeBusanLiveOpening,
  type BusanLiveOpeningResult,
} from './busanLiveOpeningNormalizer';

type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
type LiveProviderKey = 'tourapi' | BusanLiveSourceKey;
type ProviderState = 'not_mapped' | 'active' | 'inactive' | 'unavailable' | 'identity_conflict';
type FieldName = 'title' | 'address' | 'lat' | 'lon' | 'description' | 'opening' | 'closed' | 'photo';

export type MultiSourcePartition = 'tourapi_only' | 'busan_only' | 'tourapi_and_busan' | 'traditional_market_only' | 'other';
export type MultiSourceProjectionState = 'active' | 'inactive' | 'review_required' | 'source_unavailable' | 'provider_out_of_scope';
export type MultiSourceReviewReason =
  | 'snapshot_mismatch'
  | 'identity_conflict'
  | 'missing_active_fact'
  | 'title_conflict'
  | 'address_conflict'
  | 'coordinate_conflict'
  | 'description_conflict'
  | 'opening_conflict'
  | 'opening_needs_review';

export type TourLiveFieldSupplement = Readonly<{
  liveSourceSnapshotId: string;
  placeId: string;
  sourceId: string;
  openingText?: string;
  closedText?: string;
  openingResult?: LiveOpeningResult;
  description?: string;
}>;

export type MultiSourceLocalInput = DeepReadonly<{
  place: LocalLiveCatalogPlace;
  partition: MultiSourcePartition;
  tourapiSourceId?: string;
  busanMappings: readonly { source: BusanLiveSourceKey; sourceId: string }[];
}>;

export type MultiSourceProjectedCandidate = DeepReadonly<{
  id: string;
  order: number;
  state: 'active';
  facts: {
    title: string;
    address?: string;
    lat: number;
    lon: number;
    description?: string;
    availability: StructuredAvailability;
    photo?: Extract<BusanLivePhoto, { status: 'approved' }>;
  };
  provenance: Partial<Record<FieldName, readonly LiveProviderKey[]>>;
  photoDisposition: 'approved_exact' | 'default_no_approved_evidence' | 'default_conflicting_approved_urls';
  policy: LocalLiveCatalogPlace['policy'];
  relations: LocalLiveCatalogPlace['relations'];
}>;

export type MultiSourceProjectionRecord = DeepReadonly<{
  placeId: string;
  partition: MultiSourcePartition;
  classification: LocalLiveCatalogPlace['policy']['classification'];
  state: MultiSourceProjectionState;
  reason?: MultiSourceReviewReason | 'traditional_market_provider_out_of_scope' | 'no_live_provider_mapping';
  providers: readonly { provider: LiveProviderKey; sourceId: string; state: ProviderState }[];
}>;

export type MultiSourceLiveProjection = DeepReadonly<{
  status: 'ready' | 'partial' | 'unavailable';
  liveSourceSnapshotId: string | null;
  candidates: readonly MultiSourceProjectedCandidate[];
  records: readonly MultiSourceProjectionRecord[];
  summary: {
    runtimePlaces: number;
    representativePlaces: number;
    representativePartitions: {
      tourapiOnly: number;
      busanOnly: number;
      tourapiAndBusan: number;
    };
    activeRepresentative: number;
    inactive: number;
    reviewRequired: number;
    sourceUnavailable: number;
    providerOutOfScope: number;
    traditionalMarketOnly: number;
  };
}>;

type ProviderFact = Readonly<{
  provider: LiveProviderKey;
  sourceId: string;
  title: string;
  address?: string;
  lat: number;
  lon: number;
  openingText?: string;
  closedText?: string;
  openingResult?: LiveOpeningResult | BusanLiveOpeningResult;
  description?: string;
  photo?: BusanLivePhoto;
}>;

type OwnedFacts = Readonly<{
  titleAndCoordinates: readonly ProviderFact[];
  address: readonly ProviderFact[];
  description: readonly ProviderFact[];
  opening: readonly ProviderFact[];
}>;

const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const representative = new Set(['representative_core', 'representative_standard']);

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

function partition(tourapiSourceId: string | undefined, busanMappings: readonly unknown[], traditionalMarketCount: number): MultiSourcePartition {
  if (tourapiSourceId && busanMappings.length) return 'tourapi_and_busan';
  if (tourapiSourceId) return 'tourapi_only';
  if (busanMappings.length) return 'busan_only';
  if (traditionalMarketCount > 0) return 'traditional_market_only';
  return 'other';
}

const policyById = new Map(createRuntimeLiveCatalogInputs().map((place) => [place.id, place]));
const localInputs: readonly MultiSourceLocalInput[] = sourceMapping.data
  .map((mapping) => {
    const place = policyById.get(mapping.contentId);
    if (!place) throw new Error(`${mapping.contentId}: missing runtime policy input`);
    const busanMappings = (Object.entries(mapping.busanSourceIds) as [BusanLiveSourceKey, string[]][])
      .flatMap(([source, ids]) => ids.map((sourceId) => ({ source, sourceId })))
      .sort((left, right) => compare(`${left.source}:${left.sourceId}`, `${right.source}:${right.sourceId}`));
    const tourapiSourceId = mapping.tourapiContentId ?? undefined;
    return deepFreeze({
      place,
      partition: partition(tourapiSourceId, busanMappings, mapping.traditionalMarketSourceIds.length),
      ...(tourapiSourceId ? { tourapiSourceId } : {}),
      busanMappings,
    });
  })
  .sort((left, right) => compare(left.place.id, right.place.id));

export function createMultiSourceLiveInputs(): readonly MultiSourceLocalInput[] {
  return localInputs;
}

function normalizeIdentityText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/[\p{White_Space}\p{P}\p{S}]/gu, '');
}

function normalizeAddress(value: string): string {
  return normalizeIdentityText(value).replace(/부산광역시/g, '부산');
}

function canonical(values: readonly string[]): string {
  return [...values].sort((left, right) => compare(normalizeIdentityText(left), normalizeIdentityText(right)) || compare(left, right))[0];
}

function equalAvailability(left: DeepReadonly<StructuredAvailability>, right: DeepReadonly<StructuredAvailability>): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function ownedFacts(facts: readonly ProviderFact[]): OwnedFacts {
  const tour = facts.filter((fact) => fact.provider === 'tourapi');
  const busan = facts.filter((fact) => fact.provider !== 'tourapi');
  const titleAndCoordinates = tour.length > 0 ? tour : busan;
  const tourAddress = tour.filter((fact) => fact.address !== undefined);
  const busanAddress = busan.filter((fact) => fact.address !== undefined);
  const busanDescription = busan.filter((fact) => fact.description !== undefined);
  const tourDescription = tour.filter((fact) => fact.description !== undefined);
  return {
    titleAndCoordinates,
    address: tourAddress.length > 0 ? tourAddress : busanAddress,
    description: busanDescription.length > 0 ? busanDescription : tourDescription,
    opening: tour.length > 0 ? tour : busan,
  };
}

function busanCompoundIdentityConflict(local: MultiSourceLocalInput, record: BusanLiveRecord): boolean {
  const knownTitle = [local.place.identity.title, ...local.place.identity.aliases]
    .some((title) => normalizeIdentityText(title) === normalizeIdentityText(record.title));
  const distance = liveCatalogSourceDistanceMeters(local.place.identity, record);
  return !knownTitle && Number.isFinite(distance) && distance >= 1000;
}

function providerEntries(local: MultiSourceLocalInput, tour: LiveCatalogProjection, busan: BusanLiveResult): {
  states: { provider: LiveProviderKey; sourceId: string; state: ProviderState }[];
  facts: ProviderFact[];
} {
  const states: { provider: LiveProviderKey; sourceId: string; state: ProviderState }[] = [];
  const facts: ProviderFact[] = [];
  if (local.tourapiSourceId) {
    const record = tour.records.find((row) => row.placeId === local.place.id);
    const candidate = tour.candidates.find((row) => row.id === local.place.id);
    const state: ProviderState = record?.state === 'active_catalog' && candidate
      ? 'active'
      : record?.state === 'inactive'
        ? 'inactive'
        : record?.state === 'identity_conflict'
          ? 'identity_conflict'
          : 'unavailable';
    states.push({ provider: 'tourapi', sourceId: local.tourapiSourceId, state });
    if (state === 'active' && candidate) {
      facts.push({
        provider: 'tourapi',
        sourceId: local.tourapiSourceId,
        title: candidate.facts.title,
        ...(candidate.facts.address !== undefined ? { address: candidate.facts.address } : {}),
        lat: candidate.facts.lat,
        lon: candidate.facts.lon,
      });
    }
  }
  for (const mapping of local.busanMappings) {
    const sourceResult = 'sources' in busan ? busan.sources[mapping.source] : undefined;
    let state: ProviderState = 'unavailable';
    let record: BusanLiveRecord | undefined;
    if (sourceResult?.status === 'ready') {
      if (sourceResult.inactiveApprovedSourceIds.includes(mapping.sourceId)) state = 'inactive';
      else if (sourceResult.activeApprovedSourceIds.includes(mapping.sourceId)) {
        record = sourceResult.records.find((row) => row.sourceId === mapping.sourceId);
        state = record && !busanCompoundIdentityConflict(local, record) ? 'active' : 'identity_conflict';
      } else state = 'identity_conflict';
    }
    states.push({ provider: mapping.source, sourceId: mapping.sourceId, state });
    if (state === 'active' && record) {
      facts.push({
        provider: mapping.source,
        sourceId: mapping.sourceId,
        title: record.title,
        ...(record.address !== undefined ? { address: record.address } : {}),
        lat: record.lat,
        lon: record.lon,
        ...(record.openingText !== undefined ? { openingText: record.openingText } : {}),
        ...(record.closedText !== undefined ? { closedText: record.closedText } : {}),
        ...(record.description !== undefined ? { description: record.description } : {}),
        photo: record.photo,
        openingResult: normalizeBusanLiveOpening({
          placeId: local.place.id,
          source: mapping.source,
          sourceId: mapping.sourceId,
          ...(record.openingText !== undefined ? { openingText: record.openingText } : {}),
          ...(record.closedText !== undefined ? { closedText: record.closedText } : {}),
        }),
      });
    }
  }
  return { states, facts };
}

function addTourSupplement(
  local: MultiSourceLocalInput,
  facts: ProviderFact[],
  supplements: readonly TourLiveFieldSupplement[],
  snapshotId: string | null,
): ProviderFact[] {
  if (!local.tourapiSourceId) return facts;
  const index = facts.findIndex((fact) => fact.provider === 'tourapi');
  if (index < 0) return facts;
  const matches = supplements.filter((row) => row.placeId === local.place.id
    && row.sourceId === local.tourapiSourceId
    && row.liveSourceSnapshotId === snapshotId);
  if (matches.length !== 1) return facts;
  const supplement = matches[0];
  const next = [...facts];
  next[index] = {
    ...facts[index],
    ...(supplement.openingText !== undefined ? { openingText: supplement.openingText } : {}),
    ...(supplement.closedText !== undefined ? { closedText: supplement.closedText } : {}),
    ...(supplement.openingResult !== undefined ? { openingResult: supplement.openingResult } : {}),
    ...(supplement.description !== undefined ? { description: supplement.description } : {}),
  };
  return next;
}

function conflictReason(facts: readonly ProviderFact[]): MultiSourceReviewReason | null {
  if (facts.length === 0) return 'missing_active_fact';
  const owned = ownedFacts(facts);
  const titles = owned.titleAndCoordinates.map((fact) => fact.title);
  if (new Set(titles.map(normalizeIdentityText)).size > 1) return 'title_conflict';
  const addresses = owned.address.flatMap((fact) => fact.address === undefined ? [] : [fact.address]);
  if (new Set(addresses.map(normalizeAddress)).size > 1) return 'address_conflict';
  if (new Set(owned.titleAndCoordinates.map((fact) => `${fact.lat}:${fact.lon}`)).size > 1) return 'coordinate_conflict';
  const descriptions = owned.description.flatMap((fact) => fact.description === undefined ? [] : [fact.description]);
  if (new Set(descriptions.map(normalizeIdentityText)).size > 1) return 'description_conflict';
  if (owned.opening.some((fact) => fact.openingResult?.status === 'needs_review')) return 'opening_needs_review';
  const openingTexts = owned.opening.flatMap((fact) => fact.openingText === undefined ? [] : [normalizeLiveOpeningSourceText(fact.openingText)]).filter(Boolean);
  const closedTexts = owned.opening.flatMap((fact) => fact.closedText === undefined ? [] : [normalizeLiveOpeningSourceText(fact.closedText)]).filter(Boolean);
  if (new Set(openingTexts).size > 1 || new Set(closedTexts).size > 1) return 'opening_conflict';
  const availability = owned.opening.flatMap((fact) => fact.openingResult?.status === 'structured' ? [fact.openingResult.availability] : []);
  if (availability.length === 0) return 'opening_needs_review';
  if (availability.some((value) => !equalAvailability(value, availability[0]))) return 'opening_conflict';
  return null;
}

function projectedCandidate(local: MultiSourceLocalInput, facts: readonly ProviderFact[]): MultiSourceProjectedCandidate {
  const owned = ownedFacts(facts);
  const providers = (selected: readonly ProviderFact[]) => selected.map((fact) => fact.provider).sort(compare);
  const addresses = owned.address.flatMap((fact) => fact.address === undefined ? [] : [fact.address]);
  const descriptions = owned.description.flatMap((fact) => fact.description === undefined ? [] : [fact.description]);
  const availability = owned.opening.find((fact) => fact.openingResult?.status === 'structured')?.openingResult;
  if (!availability || availability.status !== 'structured') throw new Error(`${local.place.id}: structured opening missing after conflict gate`);
  const approvedPhotos = facts.flatMap((fact) => fact.photo?.status === 'approved' ? [fact.photo] : []);
  const approvedUrls = new Set(approvedPhotos.map((photo) => photo.url));
  const photo = approvedUrls.size === 1 ? approvedPhotos[0] : undefined;
  return deepFreeze({
    id: local.place.id,
    order: local.place.order,
    state: 'active',
    facts: {
      title: canonical(owned.titleAndCoordinates.map((fact) => fact.title)),
      ...(addresses.length ? { address: canonical(addresses) } : {}),
      lat: owned.titleAndCoordinates[0].lat,
      lon: owned.titleAndCoordinates[0].lon,
      ...(descriptions.length ? { description: canonical(descriptions) } : {}),
      availability: availability.availability,
      ...(photo ? { photo } : {}),
    },
    provenance: {
      title: providers(owned.titleAndCoordinates),
      lat: providers(owned.titleAndCoordinates),
      lon: providers(owned.titleAndCoordinates),
      ...(addresses.length ? { address: providers(owned.address) } : {}),
      ...(descriptions.length ? { description: providers(owned.description) } : {}),
      opening: providers(owned.opening.filter((fact) => fact.openingResult?.status === 'structured')),
      ...(owned.opening.some((fact) => fact.closedText !== undefined) ? { closed: providers(owned.opening.filter((fact) => fact.closedText !== undefined)) } : {}),
      ...(photo ? { photo: providers(facts.filter((fact) => fact.photo?.status === 'approved' && fact.photo.url === photo.url)) } : {}),
    },
    photoDisposition: photo
      ? 'approved_exact'
      : approvedUrls.size > 1
        ? 'default_conflicting_approved_urls'
        : 'default_no_approved_evidence',
    policy: local.place.policy,
    relations: local.place.relations,
  });
}

export function projectMultiSourceLiveCatalog(input: Readonly<{
  tour: LiveCatalogProjection;
  busan: BusanLiveResult;
  tourSupplements?: readonly TourLiveFieldSupplement[];
}>): MultiSourceLiveProjection {
  const busanSnapshotId = 'sources' in input.busan ? input.busan.liveSourceSnapshotId : null;
  const tourSnapshotId = input.tour.liveSourceSnapshotId;
  const snapshotMismatch = Boolean(tourSnapshotId && busanSnapshotId && tourSnapshotId !== busanSnapshotId);
  const snapshotId = snapshotMismatch ? null : tourSnapshotId ?? busanSnapshotId;
  const records: MultiSourceProjectionRecord[] = [];
  const candidates: MultiSourceProjectedCandidate[] = [];

  for (const local of localInputs) {
    if (local.partition === 'traditional_market_only' || local.partition === 'other') {
      records.push({
        placeId: local.place.id,
        partition: local.partition,
        classification: local.place.policy.classification,
        state: 'provider_out_of_scope',
        reason: local.partition === 'traditional_market_only' ? 'traditional_market_provider_out_of_scope' : 'no_live_provider_mapping',
        providers: [],
      });
      continue;
    }
    const entries = providerEntries(local, input.tour, input.busan);
    if (snapshotMismatch) {
      records.push({ placeId: local.place.id, partition: local.partition, classification: local.place.policy.classification, state: 'review_required', reason: 'snapshot_mismatch', providers: entries.states });
      continue;
    }
    if (entries.states.some((entry) => entry.state === 'identity_conflict')) {
      records.push({ placeId: local.place.id, partition: local.partition, classification: local.place.policy.classification, state: 'review_required', reason: 'identity_conflict', providers: entries.states });
      continue;
    }
    const mappedStates = entries.states.map((entry) => entry.state);
    if (mappedStates.length > 0 && mappedStates.every((state) => state === 'inactive')) {
      records.push({ placeId: local.place.id, partition: local.partition, classification: local.place.policy.classification, state: 'inactive', providers: entries.states });
      continue;
    }
    if (!mappedStates.includes('active')) {
      records.push({ placeId: local.place.id, partition: local.partition, classification: local.place.policy.classification, state: 'source_unavailable', providers: entries.states });
      continue;
    }
    const facts = addTourSupplement(local, entries.facts, input.tourSupplements ?? [], snapshotId);
    const conflict = conflictReason(facts);
    if (conflict) {
      records.push({ placeId: local.place.id, partition: local.partition, classification: local.place.policy.classification, state: 'review_required', reason: conflict, providers: entries.states });
      continue;
    }
    records.push({ placeId: local.place.id, partition: local.partition, classification: local.place.policy.classification, state: 'active', providers: entries.states });
    if (representative.has(local.place.policy.classification)) candidates.push(projectedCandidate(local, facts));
  }

  const stableRecords = records.sort((left, right) => compare(left.placeId, right.placeId));
  const stableCandidates = candidates.sort((left, right) => left.order - right.order || compare(left.id, right.id));
  const representativeInputs = localInputs.filter((local) => representative.has(local.place.policy.classification));
  const activeRepresentative = stableCandidates.length;
  const unavailable = stableRecords.filter((record) => record.state === 'source_unavailable').length;
  const reviewRequired = stableRecords.filter((record) => record.state === 'review_required').length;
  return deepFreeze({
    status: activeRepresentative === 0 && (unavailable > 0 || reviewRequired > 0) ? 'unavailable' : unavailable > 0 || reviewRequired > 0 ? 'partial' : 'ready',
    liveSourceSnapshotId: snapshotId,
    candidates: stableCandidates,
    records: stableRecords,
    summary: {
      runtimePlaces: stableRecords.length,
      representativePlaces: representativeInputs.length,
      representativePartitions: {
        tourapiOnly: representativeInputs.filter((local) => local.partition === 'tourapi_only').length,
        busanOnly: representativeInputs.filter((local) => local.partition === 'busan_only').length,
        tourapiAndBusan: representativeInputs.filter((local) => local.partition === 'tourapi_and_busan').length,
      },
      activeRepresentative,
      inactive: stableRecords.filter((record) => record.state === 'inactive').length,
      reviewRequired,
      sourceUnavailable: unavailable,
      providerOutOfScope: stableRecords.filter((record) => record.state === 'provider_out_of_scope').length,
      traditionalMarketOnly: stableRecords.filter((record) => record.reason === 'traditional_market_provider_out_of_scope').length,
    },
  });
}
