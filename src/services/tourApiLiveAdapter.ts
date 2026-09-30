export type TourLiveOperation = 'areaBasedList2' | 'detailIntro2';
export type TourLiveFailureCode = 'timeout' | 'network' | 'http_error' | 'provider_error' | 'unauthorized' | 'rate_limited' | 'invalid_response' | 'page_limit' | 'request_budget_exhausted' | 'identity_conflict';
export type SafeTourLiveFailure = Readonly<{ operation: TourLiveOperation; code: TourLiveFailureCode; status: number | null }>;
export type TourLiveCandidateRef = Readonly<{ contentId: string; contentTypeId: string }>;
export type TourLiveCatalogPlace = TourLiveCandidateRef & Readonly<{ title: string; address?: string; lat: number; lon: number; modifiedAt?: string }>;
export type TourLiveCatalogCandidateState = TourLiveCandidateRef & Readonly<{ state: 'inactive' | 'active_catalog' | 'identity_conflict' }>;
export type TourLiveDetail = TourLiveCandidateRef & Readonly<{ opening: Readonly<{ rawText?: string; closedText?: string; eventStartDate?: string; eventEndDate?: string }> }>;
export type TourLiveDetailCandidateState = TourLiveCandidateRef & Readonly<{ state: 'active_ready' | 'active_detail_failed' }>;
export type TourLiveCatalogSnapshot = Readonly<{ liveSourceSnapshotId: string; fetchedAt: string; catalogPlaces: readonly TourLiveCatalogPlace[]; candidateStates: readonly TourLiveCatalogCandidateState[]; unreviewedCount: number }>;
export type TourLiveCatalogResult = Readonly<{ kind: 'catalog'; status: 'ready'; snapshot: TourLiveCatalogSnapshot; budgetToken: string }> | Readonly<{ kind: 'catalog'; status: 'partial'; snapshot: TourLiveCatalogSnapshot; budgetToken: string; failures: readonly SafeTourLiveFailure[] }> | Readonly<{ status: 'unavailable'; reason: SafeTourLiveFailure }>;
export type TourLiveDetailBudget = Readonly<{ detailIntroUsed: number; detailIntroRemaining: number; nextBatchMax: 0 | 1 | 2 | 3 | 4 | 5 | 6; detailCommonRemaining: number; detailImageRemaining: number }>;
export type TourLiveDetailBatchResult = Readonly<{ kind: 'detail_batch'; status: 'ready'; liveSourceSnapshotId: string; details: readonly TourLiveDetail[]; candidateStates: readonly TourLiveDetailCandidateState[]; failures: readonly SafeTourLiveFailure[]; budget: TourLiveDetailBudget; budgetToken: string }> | Readonly<{ kind: 'detail_batch'; status: 'partial'; liveSourceSnapshotId: string; details: readonly TourLiveDetail[]; candidateStates: readonly TourLiveDetailCandidateState[]; failures: readonly SafeTourLiveFailure[]; budget: TourLiveDetailBudget; budgetToken: string }> | Readonly<{ status: 'unavailable'; reason: SafeTourLiveFailure }>;
export type TourApiLiveCatalogRequest = Readonly<{ action: 'catalog'; approvedCandidates: readonly TourLiveCandidateRef[] }>;
export type TourApiLiveDetailBatchRequest = Readonly<{ action: 'detail_batch'; liveSourceSnapshotId: string; budgetToken: string; candidates: readonly TourLiveCandidateRef[] }>;
export type TourApiLiveFunctionRequest = TourApiLiveCatalogRequest | TourApiLiveDetailBatchRequest;
export type TourApiLiveInvoker = { invoke(request: TourApiLiveFunctionRequest): Promise<unknown> };
export type TourApiLiveEdgeInvoker = { invoke(functionName: 'tourapi-live', options: { body: TourApiLiveFunctionRequest; headers: { Authorization: string } }): Promise<{ data: unknown; error: unknown | null }> };

/** Compatibility shape consumed only after an orchestrator explicitly merges catalog + chosen detail batches. */
export type TourLivePlace = TourLiveCatalogPlace & Readonly<{ opening: TourLiveDetail['opening'] }>;
export type TourLiveCandidateState = TourLiveCandidateRef & Readonly<{ state: 'inactive' | 'active_ready' | 'active_detail_failed' | 'identity_conflict' }>;
export type TourLiveSnapshot = Readonly<{ snapshotId: string; fetchedAt: string; places: readonly TourLivePlace[]; candidateStates: readonly TourLiveCandidateState[]; unreviewedCount: number }>;
export type TourLiveSourceResult = Readonly<{ status: 'ready'; snapshot: TourLiveSnapshot }> | Readonly<{ status: 'partial'; snapshot: TourLiveSnapshot; failures: readonly SafeTourLiveFailure[] }> | Readonly<{ status: 'unavailable'; reason: SafeTourLiveFailure }>;

const invalidFailure: SafeTourLiveFailure = { operation: 'areaBasedList2', code: 'invalid_response', status: null };
const invalidCatalog = (): TourLiveCatalogResult => ({ status: 'unavailable', reason: invalidFailure });
const invalidDetail = (): TourLiveDetailBatchResult => ({ status: 'unavailable', reason: { ...invalidFailure, operation: 'detailIntro2' } });
const operations = new Set<TourLiveOperation>(['areaBasedList2', 'detailIntro2']);
const codes = new Set<TourLiveFailureCode>(['timeout', 'network', 'http_error', 'provider_error', 'unauthorized', 'rate_limited', 'invalid_response', 'page_limit', 'request_budget_exhausted', 'identity_conflict']);
const validFailure = (value: unknown): value is SafeTourLiveFailure => !!value && typeof value === 'object' && operations.has((value as SafeTourLiveFailure).operation) && codes.has((value as SafeTourLiveFailure).code) && ((value as SafeTourLiveFailure).status === null || Number.isInteger((value as SafeTourLiveFailure).status));
const refKey = (value: TourLiveCandidateRef) => `${value.contentId}:${value.contentTypeId}`;
const validRef = (value: unknown): value is TourLiveCandidateRef => !!value && typeof value === 'object' && typeof (value as TourLiveCandidateRef).contentId === 'string' && typeof (value as TourLiveCandidateRef).contentTypeId === 'string';
const validCatalogPlace = (value: unknown): value is TourLiveCatalogPlace => validRef(value) && typeof (value as TourLiveCatalogPlace).title === 'string' && Number.isFinite((value as TourLiveCatalogPlace).lat) && Number.isFinite((value as TourLiveCatalogPlace).lon);
const validCatalogState = (value: unknown): value is TourLiveCatalogCandidateState => validRef(value) && ['inactive', 'active_catalog', 'identity_conflict'].includes((value as TourLiveCatalogCandidateState).state);
const validDetail = (value: unknown): value is TourLiveDetail => validRef(value) && !!(value as TourLiveDetail).opening && typeof (value as TourLiveDetail).opening === 'object';
const validDetailState = (value: unknown): value is TourLiveDetailCandidateState => validRef(value) && ['active_ready', 'active_detail_failed'].includes((value as TourLiveDetailCandidateState).state);

function validCatalogSnapshot(value: unknown, approved: readonly TourLiveCandidateRef[]): value is TourLiveCatalogSnapshot {
  if (!value || typeof value !== 'object') return false; const snapshot = value as TourLiveCatalogSnapshot;
  if (!snapshot.liveSourceSnapshotId || !snapshot.fetchedAt || !Number.isInteger(snapshot.unreviewedCount) || snapshot.unreviewedCount < 0 || !Array.isArray(snapshot.catalogPlaces) || !snapshot.catalogPlaces.every(validCatalogPlace) || !Array.isArray(snapshot.candidateStates) || !snapshot.candidateStates.every(validCatalogState)) return false;
  const approvedKeys = new Set(approved.map(refKey)); const stateKeys = snapshot.candidateStates.map(refKey); if (stateKeys.length !== approvedKeys.size || new Set(stateKeys).size !== stateKeys.length || stateKeys.some((key) => !approvedKeys.has(key))) return false;
  const activeKeys = new Set(snapshot.candidateStates.filter((item) => item.state === 'active_catalog').map(refKey)); const placeKeys = snapshot.catalogPlaces.map(refKey);
  return placeKeys.length === activeKeys.size && new Set(placeKeys).size === placeKeys.length && placeKeys.every((key) => activeKeys.has(key));
}
function validBudget(value: unknown): value is TourLiveDetailBudget {
  if (!value || typeof value !== 'object') return false; const budget = value as TourLiveDetailBudget;
  return Number.isInteger(budget.detailIntroUsed) && budget.detailIntroUsed >= 0 && budget.detailIntroUsed <= 30 && budget.detailIntroRemaining === 30 - budget.detailIntroUsed && Number.isInteger(budget.nextBatchMax) && budget.nextBatchMax >= 0 && budget.nextBatchMax <= 6 && Number.isInteger(budget.detailCommonRemaining) && budget.detailCommonRemaining >= 0 && budget.detailCommonRemaining <= 4 && Number.isInteger(budget.detailImageRemaining) && budget.detailImageRemaining >= 0 && budget.detailImageRemaining <= 1;
}
function validDetailResponse(value: unknown, request: TourApiLiveDetailBatchRequest): value is Exclude<TourLiveDetailBatchResult, { status: 'unavailable' }> {
  if (!value || typeof value !== 'object') return false; const result = value as Exclude<TourLiveDetailBatchResult, { status: 'unavailable' }>;
  if (result.kind !== 'detail_batch' || (result.status !== 'ready' && result.status !== 'partial') || result.liveSourceSnapshotId !== request.liveSourceSnapshotId || !result.budgetToken || !validBudget(result.budget) || !Array.isArray(result.details) || !result.details.every(validDetail) || !Array.isArray(result.candidateStates) || !result.candidateStates.every(validDetailState) || !Array.isArray(result.failures) || !result.failures.every(validFailure)) return false;
  const requested = new Set(request.candidates.map(refKey)); const stateKeys = result.candidateStates.map(refKey); if (new Set(stateKeys).size !== stateKeys.length || stateKeys.some((key) => !requested.has(key))) return false;
  const readyKeys = new Set(result.candidateStates.filter((item) => item.state === 'active_ready').map(refKey)); const detailKeys = result.details.map(refKey);
  if (detailKeys.length !== readyKeys.size || new Set(detailKeys).size !== detailKeys.length || detailKeys.some((key) => !readyKeys.has(key))) return false;
  const hasFailure = result.candidateStates.some((item) => item.state === 'active_detail_failed'); return result.status === 'partial' ? hasFailure && result.failures.length > 0 : !hasFailure && result.failures.length === 0;
}

export function createAuthenticatedTourApiLiveInvoker(input: { edge: TourApiLiveEdgeInvoker; accessToken: string }): TourApiLiveInvoker {
  const accessToken = input.accessToken.trim();
  return { async invoke(request) { if (!accessToken) return { status: 'unavailable', reason: { operation: request.action === 'catalog' ? 'areaBasedList2' : 'detailIntro2', code: 'unauthorized', status: 401 } }; try { const result = await input.edge.invoke('tourapi-live', { body: request, headers: { Authorization: `Bearer ${accessToken}` } }); return result.error ? { status: 'unavailable', reason: { operation: request.action === 'catalog' ? 'areaBasedList2' : 'detailIntro2', code: 'network', status: null } } : result.data; } catch { return { status: 'unavailable', reason: { operation: request.action === 'catalog' ? 'areaBasedList2' : 'detailIntro2', code: 'network', status: null } }; } } };
}

export function createTourApiLiveAdapter(input: { invoker: TourApiLiveInvoker }) {
  let explicitRetryUsed = false;
  const catalog = async (approvedCandidates: readonly TourLiveCandidateRef[]): Promise<TourLiveCatalogResult> => {
    let value: unknown; try { value = await input.invoker.invoke({ action: 'catalog', approvedCandidates }); } catch { return invalidCatalog(); }
    if (!value || typeof value !== 'object') return invalidCatalog(); const result = value as Record<string, unknown>;
    if (result.status === 'unavailable') return validFailure(result.reason) ? { status: 'unavailable', reason: result.reason } : invalidCatalog();
    if (result.kind !== 'catalog' || !validCatalogSnapshot(result.snapshot, approvedCandidates) || typeof result.budgetToken !== 'string' || !result.budgetToken) return invalidCatalog();
    const snapshot = result.snapshot; const hasConflict = snapshot.candidateStates.some((item) => item.state === 'identity_conflict');
    if (result.status === 'ready' && !hasConflict) return { kind: 'catalog', status: 'ready', snapshot, budgetToken: result.budgetToken };
    if (result.status === 'partial' && hasConflict && Array.isArray(result.failures) && result.failures.length > 0 && result.failures.every(validFailure)) return { kind: 'catalog', status: 'partial', snapshot, budgetToken: result.budgetToken, failures: result.failures };
    return invalidCatalog();
  };
  return {
    loadCatalog: catalog,
    async loadDetailBatch(request: Omit<TourApiLiveDetailBatchRequest, 'action'>): Promise<TourLiveDetailBatchResult> {
      const full: TourApiLiveDetailBatchRequest = { action: 'detail_batch', ...request }; let value: unknown;
      try { value = await input.invoker.invoke(full); } catch { return invalidDetail(); }
      if (value && typeof value === 'object' && (value as Record<string, unknown>).status === 'unavailable') { const reason = (value as { reason?: unknown }).reason; return validFailure(reason) ? { status: 'unavailable', reason } : invalidDetail(); }
      return validDetailResponse(value, full) ? value : invalidDetail();
    },
    async retryCatalog(approvedCandidates: readonly TourLiveCandidateRef[]): Promise<TourLiveCatalogResult> {
      if (explicitRetryUsed) return { status: 'unavailable', reason: { operation: 'areaBasedList2', code: 'request_budget_exhausted', status: null } };
      explicitRetryUsed = true; return catalog(approvedCandidates);
    },
  };
}

export function mergeTourLiveDetailBatches(catalog: TourLiveCatalogSnapshot, batches: readonly Exclude<TourLiveDetailBatchResult, { status: 'unavailable' }>[]) {
  const detailByKey = new Map<string, TourLiveDetail>(); const detailStateByKey = new Map<string, TourLiveDetailCandidateState>();
  for (const batch of batches) { if (batch.liveSourceSnapshotId !== catalog.liveSourceSnapshotId) return null; for (const detail of batch.details) detailByKey.set(refKey(detail), detail); for (const state of batch.candidateStates) detailStateByKey.set(refKey(state), state); }
  return {
    liveSourceSnapshotId: catalog.liveSourceSnapshotId,
    fetchedAt: catalog.fetchedAt,
    places: catalog.catalogPlaces.flatMap((place) => { const detail = detailByKey.get(refKey(place)); return detail ? [{ ...place, opening: detail.opening }] : []; }),
    candidateStates: catalog.candidateStates.map((state) => detailStateByKey.get(refKey(state)) ?? state),
    unreviewedCount: catalog.unreviewedCount,
  } as const;
}
