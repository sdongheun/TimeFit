import type { TourLivePlace, TourLiveSourceResult } from '../services/tourApiLiveAdapter';
import type { CourseV1Candidate } from './courseV1';

type Opening = TourLivePlace['opening'];
type Facts = { title: string; address?: string; lat: number; lon: number; modifiedAt?: string; opening: Opening };
/** Trusted local policy projection, not a catalog/raw-provider object. Identity facts must be reviewed source facts, never AI-Hub. */
export type LocalLivePlaceProjection = {
  id: string;
  order: number;
  mapping?: { status: 'exact'; tourapiContentId: string; contentTypeId: string };
  facts: Facts;
  aliases: readonly string[];
  policy: Pick<CourseV1Candidate, 'category' | 'subCategory' | 'classification' | 'minStayMin' | 'recommendedStayMin' | 'maxStayMin'>;
  relations: { siteGroupId?: string; siteRole?: string; mergedPlaceIds: string[] };
  photoRights: readonly { url: string; status: string; attribution?: string }[];
};
type Provenance = 'tourapi_live';
type FactField = 'title' | 'address' | 'lat' | 'lon' | 'modifiedAt' | `opening.${keyof Opening}`;
type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
export type LiveCandidate = DeepReadonly<Omit<LocalLivePlaceProjection, 'mapping'> & {
  tourapiContentId: string; contentTypeId: string;
  provenance: Partial<Record<FactField, Provenance>>;
  /** Source-ready does not mean opening/route-verified. No CourseV1 provider adapter is exposed here. */
  openingVerification: 'required';
}>;
export type LiveCandidateDiagnostic = Readonly<{ placeId: string; reason: 'inactive' | 'detail_failed' | 'review_required' | 'out_of_scope' | 'not_in_snapshot' | 'source_unavailable' | 'invalid_source'; detail?: 'content_type_changed' | 'compound_identity_change' | 'identity_conflict' | 'ambiguous_mapping' }>;
export type LiveCandidateSnapshot = Readonly<{
  status: 'ready' | 'partial' | 'unavailable'; snapshotId: string | null; fetchedAt: string | null;
  candidates: readonly LiveCandidate[]; diagnostics: readonly LiveCandidateDiagnostic[];
}>;

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const normalizeTitle = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[\p{White_Space}\p{P}\p{S}]/gu, '');
const validPoint = (p: { lat: number; lon: number }) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
/** Deterministic source-coordinate distance, never user location or route estimation. Invalid coordinates return NaN. */
export function sourceDistanceMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  if (!validPoint(a) || !validPoint(b)) return NaN;
  const rad = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lon - a.lon) * rad / 2) ** 2;
  // Normalize sub-micrometer floating error so the inclusive 1km boundary is stable.
  const meters = 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
  return Math.round(meters * 1e6) / 1e6;
}
function freeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}
const openingKeys = ['rawText', 'closedText', 'eventStartDate', 'eventEndDate'] as const;

/** Pure session preparation. No network, clock, storage, catalog import, matching by name, or recommendation activation. */
export function buildLiveCandidateSnapshot(local: readonly LocalLivePlaceProjection[], source: TourLiveSourceResult): LiveCandidateSnapshot {
  const candidates: LiveCandidate[] = [], diagnostics: LiveCandidateDiagnostic[] = [];
  const sorted = [...local].sort((a, b) => a.order - b.order || compare(a.id, b.id));
  const exclude = (placeId: string, reason: LiveCandidateDiagnostic['reason'], detail?: LiveCandidateDiagnostic['detail']) => diagnostics.push({ placeId, reason, ...(detail ? { detail } : {}) });
  for (const p of sorted) {
    if (source.status === 'unavailable') { exclude(p.id, 'source_unavailable'); continue; }
    if (!p.mapping || p.mapping.status !== 'exact') { exclude(p.id, 'out_of_scope'); continue; }
    const { tourapiContentId, contentTypeId } = p.mapping;
    if (local.filter(x => x.id === p.id).length !== 1 || local.filter(x => x.mapping?.tourapiContentId === tourapiContentId).length !== 1) {
      exclude(p.id, 'review_required', 'ambiguous_mapping'); continue;
    }
    const states = source.snapshot.candidateStates.filter(x => x.contentId === tourapiContentId);
    if (!states.length) { exclude(p.id, 'not_in_snapshot'); continue; }
    if (states.length !== 1) { exclude(p.id, 'review_required', 'ambiguous_mapping'); continue; }
    const state = states[0];
    if (state.contentTypeId !== contentTypeId) { exclude(p.id, 'review_required', 'content_type_changed'); continue; }
    if (state.state === 'identity_conflict') { exclude(p.id, 'review_required', 'identity_conflict'); continue; }
    if (state.state === 'inactive') { exclude(p.id, 'inactive'); continue; }
    if (state.state === 'active_detail_failed') { exclude(p.id, 'detail_failed'); continue; }
    const matches = source.snapshot.places.filter(x => x.contentId === tourapiContentId);
    if (matches.length !== 1) { exclude(p.id, 'invalid_source'); continue; }
    const live = matches[0];
    if (live.contentTypeId !== contentTypeId) { exclude(p.id, 'review_required', 'content_type_changed'); continue; }
    if (!validPoint(live) || !validPoint(p.facts) || !live.title.trim()) { exclude(p.id, 'invalid_source'); continue; }
    const knownTitle = [p.facts.title, ...p.aliases].some(title => normalizeTitle(title) === normalizeTitle(live.title));
    if (!knownTitle && sourceDistanceMeters(p.facts, live) >= 1000) { exclude(p.id, 'review_required', 'compound_identity_change'); continue; }
    // Only allowlisted public facts cross the boundary; provider errors and unrelated extras are never spread.
    const facts: Facts = { title: live.title, lat: live.lat, lon: live.lon, opening: {} };
    const provenance: Partial<Record<FactField, Provenance>> = { title: 'tourapi_live', lat: 'tourapi_live', lon: 'tourapi_live' };
    for (const key of ['address', 'modifiedAt'] as const) {
      const value = live[key];
      if (value !== undefined) { facts[key] = value; provenance[key] = 'tourapi_live'; }
    }
    const opening: { -readonly [K in keyof Opening]: Opening[K] } = {};
    for (const key of openingKeys) {
      const value = live.opening[key];
      if (value !== undefined) { opening[key] = value; provenance[`opening.${key}`] = 'tourapi_live'; }
    }
    facts.opening = opening;
    candidates.push(freeze({ id: p.id, order: p.order, tourapiContentId, contentTypeId, facts, aliases: [...p.aliases],
      policy: { category: p.policy.category, subCategory: p.policy.subCategory, classification: p.policy.classification, minStayMin: p.policy.minStayMin, recommendedStayMin: p.policy.recommendedStayMin, maxStayMin: p.policy.maxStayMin },
      relations: { siteGroupId: p.relations.siteGroupId, siteRole: p.relations.siteRole, mergedPlaceIds: [...p.relations.mergedPlaceIds] },
      photoRights: p.photoRights.map(photo => ({ url: photo.url, status: photo.status, ...(photo.attribution !== undefined ? { attribution: photo.attribution } : {}) })),
      provenance, openingVerification: 'required' as const }));
  }
  const hasFailure = diagnostics.some(d => d.reason === 'detail_failed' || d.reason === 'review_required' || d.reason === 'invalid_source');
  return freeze({ status: source.status === 'unavailable' ? 'unavailable' : source.status === 'partial' || hasFailure ? 'partial' : 'ready',
    snapshotId: source.status === 'unavailable' ? null : source.snapshot.snapshotId,
    fetchedAt: source.status === 'unavailable' ? null : source.snapshot.fetchedAt, candidates, diagnostics });
}
