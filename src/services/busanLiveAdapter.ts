export type BusanLiveSourceKey = 'busan_attraction' | 'busan_food' | 'busan_shopping';
export type BusanLiveFailureCode = 'timeout' | 'network' | 'http_error' | 'provider_error' | 'unauthorized' | 'rate_limited' | 'invalid_response' | 'page_limit' | 'request_budget_exhausted';
export type SafeBusanLiveFailure = Readonly<{ code: BusanLiveFailureCode; status: number | null }>;
export type BusanApprovedPhotoEvidence = Readonly<{
  sourceId: string;
  url: string;
  attribution: string;
  sourcePageUrl: string;
  licenseName: '이용허락범위 제한 없음';
  commercialUseAllowed: true;
  modificationAllowed: true;
  verifiedAt: string;
}>;
export type BusanLiveRequest = Readonly<{
  action: 'catalog_snapshot';
  liveSourceSnapshotId: string;
  approvedSourceIds: Readonly<Record<BusanLiveSourceKey, readonly string[]>>;
  approvedPhotos: Readonly<Record<BusanLiveSourceKey, readonly BusanApprovedPhotoEvidence[]>>;
}>;
export type BusanLivePhoto = Readonly<{
  status: 'approved';
  url: string;
  attribution: string;
  sourcePageUrl: string;
  licenseName: '이용허락범위 제한 없음';
  commercialUseAllowed: true;
  modificationAllowed: true;
  verifiedAt: string;
}> | Readonly<{ status: 'not_returned_without_approved_evidence' }>;
export type BusanLiveRecord = Readonly<{
  source: BusanLiveSourceKey;
  sourceId: string;
  title: string;
  address?: string;
  lat: number;
  lon: number;
  openingText?: string;
  closedText?: string;
  description?: string;
  photo: BusanLivePhoto;
}>;
export type BusanLiveSourceResult = Readonly<{
  status: 'ready';
  complete: true;
  providerCalls: 1 | 2;
  activeApprovedSourceIds: readonly string[];
  inactiveApprovedSourceIds: readonly string[];
  records: readonly BusanLiveRecord[];
}> | Readonly<{
  status: 'unavailable';
  complete: false;
  providerCalls: 0 | 1 | 2;
  reason: SafeBusanLiveFailure;
}>;
export type BusanLiveResult = Readonly<{
  status: 'ready' | 'partial' | 'unavailable';
  liveSourceSnapshotId: string;
  providerCalls: number;
  sources: Readonly<Record<BusanLiveSourceKey, BusanLiveSourceResult>>;
}> | Readonly<{ status: 'unavailable'; providerCalls: 0; reason: SafeBusanLiveFailure }>;

export type BusanLiveInvoker = { invoke(request: BusanLiveRequest): Promise<unknown> };
export type BusanLiveEdgeInvoker = { invoke(functionName: 'busan-live', options: { body: BusanLiveRequest; headers: { Authorization: string } }): Promise<{ data: unknown; error: unknown | null }> };

const sources: readonly BusanLiveSourceKey[] = ['busan_attraction', 'busan_food', 'busan_shopping'];
const failureCodes = new Set<BusanLiveFailureCode>(['timeout', 'network', 'http_error', 'provider_error', 'unauthorized', 'rate_limited', 'invalid_response', 'page_limit', 'request_budget_exhausted']);
const invalid = (): BusanLiveResult => ({ status: 'unavailable', providerCalls: 0, reason: { code: 'invalid_response', status: null } });
const validFailure = (value: unknown): value is SafeBusanLiveFailure => !!value && typeof value === 'object' && failureCodes.has((value as SafeBusanLiveFailure).code) && ((value as SafeBusanLiveFailure).status === null || Number.isInteger((value as SafeBusanLiveFailure).status));
const validPhoto = (value: unknown, evidence: readonly BusanApprovedPhotoEvidence[]) => {
  if (!value || typeof value !== 'object') return false;
  const photo = value as BusanLivePhoto;
  if (photo.status === 'not_returned_without_approved_evidence') return Object.keys(photo).length === 1;
  return photo.status === 'approved' && evidence.some((item) => item.url === photo.url && item.attribution === photo.attribution && item.sourcePageUrl === photo.sourcePageUrl && item.licenseName === photo.licenseName && item.commercialUseAllowed === photo.commercialUseAllowed && item.modificationAllowed === photo.modificationAllowed && item.verifiedAt === photo.verifiedAt);
};
const validRecord = (value: unknown, source: BusanLiveSourceKey, approved: Set<string>, evidence: readonly BusanApprovedPhotoEvidence[]): value is BusanLiveRecord => {
  if (!value || typeof value !== 'object') return false;
  const record = value as BusanLiveRecord;
  return record.source === source && approved.has(record.sourceId) && typeof record.title === 'string' && !!record.title && Number.isFinite(record.lat) && record.lat >= -90 && record.lat <= 90 && Number.isFinite(record.lon) && record.lon >= -180 && record.lon <= 180
    && (record.address === undefined || typeof record.address === 'string') && (record.openingText === undefined || typeof record.openingText === 'string') && (record.closedText === undefined || typeof record.closedText === 'string') && (record.description === undefined || typeof record.description === 'string') && validPhoto(record.photo, evidence);
};
function validSourceResult(value: unknown, source: BusanLiveSourceKey, request: BusanLiveRequest): value is BusanLiveSourceResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as BusanLiveSourceResult;
  if (result.status === 'unavailable') return result.complete === false && [0, 1, 2].includes(result.providerCalls) && validFailure(result.reason);
  const approved = new Set(request.approvedSourceIds[source]);
  if (result.complete !== true || ![1, 2].includes(result.providerCalls) || !Array.isArray(result.activeApprovedSourceIds) || !Array.isArray(result.inactiveApprovedSourceIds) || !Array.isArray(result.records)) return false;
  const active = result.activeApprovedSourceIds;
  const inactive = result.inactiveApprovedSourceIds;
  if (new Set(active).size !== active.length || new Set(inactive).size !== inactive.length || active.some((id) => !approved.has(id)) || inactive.some((id) => !approved.has(id) || active.includes(id)) || active.length + inactive.length !== approved.size) return false;
  if (!result.records.every((record) => validRecord(record, source, approved, request.approvedPhotos[source]))) return false;
  const recordIds = result.records.map((record) => record.sourceId);
  return new Set(recordIds).size === recordIds.length && recordIds.length === active.length && recordIds.every((id) => active.includes(id));
}
function validateResult(value: unknown, request: BusanLiveRequest): BusanLiveResult {
  if (!value || typeof value !== 'object') return invalid();
  const result = value as BusanLiveResult;
  if (!('sources' in result)) return result.status === 'unavailable' && result.providerCalls === 0 && validFailure(result.reason) ? result : invalid();
  if (result.liveSourceSnapshotId !== request.liveSourceSnapshotId || !Number.isInteger(result.providerCalls) || result.providerCalls < 0 || result.providerCalls > BUSAN_LIVE_LIMITS.providerCalls || !result.sources || typeof result.sources !== 'object') return invalid();
  if (!sources.every((source) => validSourceResult(result.sources[source], source, request))) return invalid();
  const callTotal = sources.reduce((sum, source) => sum + result.sources[source].providerCalls, 0);
  const readyCount = sources.filter((source) => result.sources[source].status === 'ready').length;
  const expectedStatus = readyCount === sources.length ? 'ready' : readyCount === 0 ? 'unavailable' : 'partial';
  return result.providerCalls === callTotal && result.status === expectedStatus ? result : invalid();
}

export function createAuthenticatedBusanLiveInvoker(input: { edge: BusanLiveEdgeInvoker; accessToken: string }): BusanLiveInvoker {
  const token = input.accessToken.trim();
  return {
    async invoke(request) {
      if (!token) return { status: 'unavailable', providerCalls: 0, reason: { code: 'unauthorized', status: 401 } };
      try {
        const result = await input.edge.invoke('busan-live', { body: request, headers: { Authorization: `Bearer ${token}` } });
        return result.error ? { status: 'unavailable', providerCalls: 0, reason: { code: 'network', status: null } } : result.data;
      } catch {
        return { status: 'unavailable', providerCalls: 0, reason: { code: 'network', status: null } };
      }
    },
  };
}

export function createBusanLiveAdapter(input: { invoker: BusanLiveInvoker }) {
  let initialSnapshotId = '';
  let explicitRetryUsed = false;
  const load = async (request: BusanLiveRequest) => {
    let value: unknown;
    try { value = await input.invoker.invoke(request); } catch { return invalid(); }
    return validateResult(value, request);
  };
  return {
    async loadSnapshot(request: BusanLiveRequest) {
      initialSnapshotId = request.liveSourceSnapshotId;
      return load(request);
    },
    async retrySnapshot(request: BusanLiveRequest) {
      if (explicitRetryUsed || !initialSnapshotId || request.liveSourceSnapshotId === initialSnapshotId) return { status: 'unavailable', providerCalls: 0, reason: { code: 'request_budget_exhausted', status: null } } as const;
      explicitRetryUsed = true;
      return load(request);
    },
  };
}

export const BUSAN_LIVE_LIMITS = Object.freeze({
  pageSize: 500,
  pagesPerSource: 2,
  providerCalls: 6,
  sourceConcurrency: 2,
  pageTimeoutMs: 4000,
  automaticRetries: 0,
  explicitRetries: 1,
});
