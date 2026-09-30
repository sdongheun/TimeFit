import type { LiveProviderBudgetDecision } from '../_shared/liveProviderBudget';

type BusanLiveSourceKey = 'busan_attraction' | 'busan_food' | 'busan_shopping';
type BusanLiveFailureCode = 'timeout' | 'network' | 'http_error' | 'provider_error' | 'unauthorized' | 'rate_limited' | 'invalid_response' | 'page_limit' | 'request_budget_exhausted';
type SafeBusanLiveFailure = Readonly<{ code: BusanLiveFailureCode; status: number | null }>;
type BusanApprovedPhotoEvidence = Readonly<{ sourceId: string; url: string; attribution: string; sourcePageUrl: string; licenseName: '이용허락범위 제한 없음'; commercialUseAllowed: true; modificationAllowed: true; verifiedAt: string }>;
type BusanLiveRecord = Readonly<{ source: BusanLiveSourceKey; sourceId: string; title: string; address?: string; lat: number; lon: number; openingText?: string; closedText?: string; description?: string; photo: Readonly<{ status: 'approved'; url: string; attribution: string; sourcePageUrl: string; licenseName: '이용허락범위 제한 없음'; commercialUseAllowed: true; modificationAllowed: true; verifiedAt: string }> | Readonly<{ status: 'not_returned_without_approved_evidence' }> }>;
type BusanLiveRequest = Readonly<{ action: 'catalog_snapshot'; liveSourceSnapshotId: string; approvedSourceIds: Readonly<Record<BusanLiveSourceKey, readonly string[]>>; approvedPhotos: Readonly<Record<BusanLiveSourceKey, readonly BusanApprovedPhotoEvidence[]>> }>;
type BusanLiveSourceResult = Readonly<{ status: 'ready'; complete: true; providerCalls: 1 | 2; activeApprovedSourceIds: readonly string[]; inactiveApprovedSourceIds: readonly string[]; records: readonly BusanLiveRecord[] }> | Readonly<{ status: 'unavailable'; complete: false; providerCalls: 0 | 1 | 2; reason: SafeBusanLiveFailure }>;

const BUSAN_LIVE_LIMITS = Object.freeze({ pageSize: 500, pagesPerSource: 2, providerCalls: 6, sourceConcurrency: 2, pageTimeoutMs: 4000, automaticRetries: 0 });

type Deps = Readonly<{
  fetch: typeof fetch;
  authenticate: (token: string) => Promise<boolean>;
  serviceKey: string;
  reserveProviderAttempt?: (operation: 'attractions_page' | 'food_page' | 'shopping_page') => Promise<LiveProviderBudgetDecision>;
  timeoutSignal?: (milliseconds: number) => AbortSignal;
}>;
type ParsedPage = Readonly<{ pageNo: number; numOfRows: number; totalCount: number; rows: readonly Record<string, unknown>[] }>;

const sourceKeys: readonly BusanLiveSourceKey[] = ['busan_attraction', 'busan_food', 'busan_shopping'];
const configs: Readonly<Record<BusanLiveSourceKey, Readonly<{ endpoint: string; operation: string; sourcePageUrl: string }>>> = {
  busan_attraction: { endpoint: 'https://apis.data.go.kr/6260000/AttractionService/getAttractionKr', operation: 'getAttractionKr', sourcePageUrl: 'https://www.data.go.kr/data/15063481/openapi.do' },
  busan_food: { endpoint: 'https://apis.data.go.kr/6260000/FoodService/getFoodKr', operation: 'getFoodKr', sourcePageUrl: 'https://www.data.go.kr/data/15063472/openapi.do' },
  busan_shopping: { endpoint: 'https://apis.data.go.kr/6260000/ShoppingService/getShoppingKr', operation: 'getShoppingKr', sourcePageUrl: 'https://www.data.go.kr/data/15063487/openapi.do' },
};
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const failure = (code: BusanLiveFailureCode, status: number | null = null): SafeBusanLiveFailure => ({ code, status });
const unavailable = (reason: SafeBusanLiveFailure, status = 200) => json({ status: 'unavailable', providerCalls: 0, reason }, status);
const text = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
const integer = (value: unknown) => { const parsed = Number(value); return Number.isInteger(parsed) ? parsed : null; };
const finite = (value: unknown) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; };
const bearer = (request: Request) => { const value = request.headers.get('Authorization') ?? ''; return value.startsWith('Bearer ') ? value.slice(7).trim() : ''; };

export function createProviderCallBudget(limit = BUSAN_LIVE_LIMITS.providerCalls) {
  let used = 0;
  return { reserve() { if (used >= limit) return false; used += 1; return true; }, used: () => used };
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]) { return Object.keys(value).sort().join(',') === [...allowed].sort().join(','); }
function parseIds(value: unknown) {
  if (!Array.isArray(value) || value.length > 200) return null;
  const ids = value.map(text);
  return ids.every((id) => /^\d{1,20}$/.test(id)) && new Set(ids).size === ids.length ? ids : null;
}
function parsePhoto(value: unknown, ids: Set<string>, source: BusanLiveSourceKey): BusanApprovedPhotoEvidence | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (!exactKeys(row, ['sourceId', 'url', 'attribution', 'sourcePageUrl', 'licenseName', 'commercialUseAllowed', 'modificationAllowed', 'verifiedAt'])) return null;
  const sourceId = text(row.sourceId); const url = text(row.url); const attribution = text(row.attribution); const sourcePageUrl = text(row.sourcePageUrl); const verifiedAt = text(row.verifiedAt);
  if (!ids.has(sourceId) || !url.startsWith('https://') || !attribution || sourcePageUrl !== configs[source].sourcePageUrl || row.licenseName !== '이용허락범위 제한 없음' || row.commercialUseAllowed !== true || row.modificationAllowed !== true || !/^\d{4}-\d{2}-\d{2}$/.test(verifiedAt)) return null;
  return { sourceId, url, attribution, sourcePageUrl, licenseName: '이용허락범위 제한 없음', commercialUseAllowed: true, modificationAllowed: true, verifiedAt };
}
function parseInput(value: unknown): BusanLiveRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (!exactKeys(row, ['action', 'liveSourceSnapshotId', 'approvedSourceIds', 'approvedPhotos']) || row.action !== 'catalog_snapshot') return null;
  const snapshotId = text(row.liveSourceSnapshotId);
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(snapshotId)) return null;
  if (!row.approvedSourceIds || typeof row.approvedSourceIds !== 'object' || Array.isArray(row.approvedSourceIds) || !row.approvedPhotos || typeof row.approvedPhotos !== 'object' || Array.isArray(row.approvedPhotos)) return null;
  const idsInput = row.approvedSourceIds as Record<string, unknown>; const photosInput = row.approvedPhotos as Record<string, unknown>;
  if (!exactKeys(idsInput, sourceKeys) || !exactKeys(photosInput, sourceKeys)) return null;
  const approvedSourceIds = {} as Record<BusanLiveSourceKey, string[]>; const approvedPhotos = {} as Record<BusanLiveSourceKey, BusanApprovedPhotoEvidence[]>;
  for (const source of sourceKeys) {
    const ids = parseIds(idsInput[source]); if (!ids || !Array.isArray(photosInput[source]) || photosInput[source].length > ids.length) return null;
    const parsedPhotos = (photosInput[source] as unknown[]).map((photo) => parsePhoto(photo, new Set(ids), source));
    if (parsedPhotos.some((photo) => !photo)) return null;
    const photos = parsedPhotos as BusanApprovedPhotoEvidence[];
    if (new Set(photos.map((photo) => photo.sourceId)).size !== photos.length) return null;
    approvedSourceIds[source] = ids; approvedPhotos[source] = photos;
  }
  return { action: 'catalog_snapshot', liveSourceSnapshotId: snapshotId, approvedSourceIds, approvedPhotos };
}

function providerCode(raw: unknown, operation: string) {
  if (!raw || typeof raw !== 'object') return '';
  const root = raw as Record<string, unknown>; const response = root.response;
  const container = response && typeof response === 'object' ? response as Record<string, unknown> : root[operation] && typeof root[operation] === 'object' ? root[operation] as Record<string, unknown> : null;
  const header = container?.header;
  return header && typeof header === 'object' ? text((header as Record<string, unknown>).resultCode) || text((header as Record<string, unknown>).code) : '';
}
function parsePage(raw: unknown, operation: string): ParsedPage | null {
  if (!raw || typeof raw !== 'object') return null;
  const root = raw as Record<string, unknown>; const response = root.response;
  let body: Record<string, unknown> | null = null;
  if (response && typeof response === 'object') {
    const responseBody = (response as Record<string, unknown>).body;
    if (responseBody && typeof responseBody === 'object') body = responseBody as Record<string, unknown>;
  } else if (root[operation] && typeof root[operation] === 'object') body = root[operation] as Record<string, unknown>;
  if (!body) return null;
  const pageNo = integer(body.pageNo); const numOfRows = integer(body.numOfRows); const totalCount = integer(body.totalCount);
  const itemsNode = body.items && typeof body.items === 'object' ? (body.items as Record<string, unknown>).item : body.item;
  const rawRows = Array.isArray(itemsNode) ? itemsNode : itemsNode && typeof itemsNode === 'object' ? [itemsNode] : [];
  if (pageNo === null || numOfRows === null || totalCount === null || totalCount < 0 || !rawRows.every((item) => !!item && typeof item === 'object' && !Array.isArray(item))) return null;
  return { pageNo, numOfRows, totalCount, rows: rawRows as Record<string, unknown>[] };
}
function providerFailure(status: number) { if (status === 401 || status === 403) return failure('unauthorized', status); if (status === 429) return failure('rate_limited', status); return failure('http_error', status); }
function codeFailure(code: string) { if (['20', '30', '31'].includes(code)) return failure('unauthorized'); if (['22', '23'].includes(code)) return failure('rate_limited'); return failure('provider_error'); }
function timeoutCode(error: unknown): BusanLiveFailureCode { return error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError') ? 'timeout' : 'network'; }

function approvedPhoto(row: Record<string, unknown>, evidence: BusanApprovedPhotoEvidence | undefined) {
  if (!evidence) return { status: 'not_returned_without_approved_evidence' as const };
  const normal = text(row.MAIN_IMG_NORMAL); const thumb = text(row.MAIN_IMG_THUMB);
  return evidence.url === normal || evidence.url === thumb ? { status: 'approved' as const, url: evidence.url, attribution: evidence.attribution, sourcePageUrl: evidence.sourcePageUrl, licenseName: evidence.licenseName, commercialUseAllowed: evidence.commercialUseAllowed, modificationAllowed: evidence.modificationAllowed, verifiedAt: evidence.verifiedAt } : { status: 'not_returned_without_approved_evidence' as const };
}
function normalize(row: Record<string, unknown>, source: BusanLiveSourceKey, evidence: BusanApprovedPhotoEvidence | undefined): BusanLiveRecord | null {
  const sourceId = text(row.UC_SEQ); const title = text(row.MAIN_TITLE); const lat = finite(row.LAT); const lon = finite(row.LNG);
  if (!sourceId || !title || lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  const address = text(row.ADDR1) || text(row.ADDR2); const openingText = text(row.USAGE_DAY_WEEK_AND_TIME) || text(row.USAGE_DAY); const closedText = text(row.HLDY_INFO); const description = text(row.ITEMCNTNTS);
  return { source, sourceId, title, ...(address ? { address } : {}), lat, lon, ...(openingText ? { openingText } : {}), ...(closedText ? { closedText } : {}), ...(description ? { description } : {}), photo: approvedPhoto(row, evidence) };
}

export function createBusanLiveHandler(deps: Deps) {
  const timeoutSignal = deps.timeoutSignal ?? ((milliseconds: number) => AbortSignal.timeout(milliseconds));
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return unavailable(failure('invalid_response'), 405);
    const token = bearer(request);
    if (!token || !(await deps.authenticate(token).catch(() => false))) return unavailable(failure('unauthorized', 401), 401);
    if (!deps.serviceKey) return unavailable(failure('unauthorized'));
    let body: unknown;
    try { body = await request.json(); } catch { return unavailable(failure('invalid_response'), 400); }
    const input = parseInput(body);
    if (!input) return unavailable(failure('invalid_response'), 400);

    const budget = createProviderCallBudget();
    const sourceResults = {} as Record<BusanLiveSourceKey, BusanLiveSourceResult>;
    const runSource = async (source: BusanLiveSourceKey) => {
      const config = configs[source]; let providerCalls = 0; let expectedTotal: number | null = null; const rows: Record<string, unknown>[] = []; const seen = new Set<string>();
      const callPage = async (pageNo: number): Promise<{ page?: ParsedPage; reason?: SafeBusanLiveFailure }> => {
        if (budget.used() >= BUSAN_LIVE_LIMITS.providerCalls) return { reason: failure('request_budget_exhausted') };
        let reservation: LiveProviderBudgetDecision = 'unavailable';
        try { reservation = await deps.reserveProviderAttempt?.(source === 'busan_attraction' ? 'attractions_page' : source === 'busan_food' ? 'food_page' : 'shopping_page') ?? 'unavailable'; } catch { /* no provider request without a confirmed grant */ }
        if (reservation !== 'granted' || !budget.reserve()) return { reason: failure('request_budget_exhausted') };
        providerCalls += 1;
        const url = new URL(config.endpoint); url.searchParams.set('ServiceKey', deps.serviceKey); url.searchParams.set('pageNo', String(pageNo)); url.searchParams.set('numOfRows', String(BUSAN_LIVE_LIMITS.pageSize)); url.searchParams.set('resultType', 'json');
        let response: Response;
        try { response = await deps.fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, signal: timeoutSignal(BUSAN_LIVE_LIMITS.pageTimeoutMs) }); } catch (error) { return { reason: failure(timeoutCode(error)) }; }
        if (!response.ok) return { reason: providerFailure(response.status) };
        let raw: unknown; try { raw = await response.json(); } catch { return { reason: failure('invalid_response') }; }
        const code = providerCode(raw, config.operation); if (!code) return { reason: failure('invalid_response') }; if (code !== '00' && code !== '0000') return { reason: codeFailure(code) };
        const page = parsePage(raw, config.operation);
        return page ? { page } : { reason: failure('invalid_response') };
      };
      for (let pageNo = 1; pageNo <= BUSAN_LIVE_LIMITS.pagesPerSource; pageNo += 1) {
        const result = await callPage(pageNo);
        if (result.reason || !result.page) return { status: 'unavailable' as const, complete: false as const, providerCalls: providerCalls as 0 | 1 | 2, reason: result.reason ?? failure('invalid_response') };
        const page = result.page;
        if (page.pageNo !== pageNo || page.numOfRows !== BUSAN_LIVE_LIMITS.pageSize || (expectedTotal !== null && page.totalCount !== expectedTotal)) return { status: 'unavailable' as const, complete: false as const, providerCalls: providerCalls as 0 | 1 | 2, reason: failure('invalid_response') };
        if (expectedTotal === null) { expectedTotal = page.totalCount; if (expectedTotal > BUSAN_LIVE_LIMITS.pageSize * BUSAN_LIVE_LIMITS.pagesPerSource) return { status: 'unavailable' as const, complete: false as const, providerCalls: providerCalls as 0 | 1 | 2, reason: failure('page_limit') }; }
        const expectedRows = Math.min(BUSAN_LIVE_LIMITS.pageSize, expectedTotal - rows.length);
        if (expectedRows < 0 || page.rows.length !== expectedRows) return { status: 'unavailable' as const, complete: false as const, providerCalls: providerCalls as 0 | 1 | 2, reason: failure('invalid_response') };
        for (const row of page.rows) { const id = text(row.UC_SEQ); if (!/^\d{1,20}$/.test(id) || seen.has(id)) return { status: 'unavailable' as const, complete: false as const, providerCalls: providerCalls as 0 | 1 | 2, reason: failure('invalid_response') }; seen.add(id); rows.push(row); }
        if (rows.length >= expectedTotal) break;
      }
      if (expectedTotal === null || rows.length !== expectedTotal) return { status: 'unavailable' as const, complete: false as const, providerCalls: providerCalls as 0 | 1 | 2, reason: failure(rows.length < (expectedTotal ?? 0) ? 'page_limit' : 'invalid_response') };
      const byId = new Map(rows.map((row) => [text(row.UC_SEQ), row])); const photoById = new Map(input.approvedPhotos[source].map((photo) => [photo.sourceId, photo])); const records: BusanLiveRecord[] = [];
      for (const sourceId of input.approvedSourceIds[source]) { const row = byId.get(sourceId); if (!row) continue; const record = normalize(row, source, photoById.get(sourceId)); if (!record) return { status: 'unavailable' as const, complete: false as const, providerCalls: providerCalls as 0 | 1 | 2, reason: failure('invalid_response') }; records.push(record); }
      const activeApprovedSourceIds = records.map((record) => record.sourceId); const active = new Set(activeApprovedSourceIds); const inactiveApprovedSourceIds = input.approvedSourceIds[source].filter((id) => !active.has(id));
      return { status: 'ready' as const, complete: true as const, providerCalls: providerCalls as 1 | 2, activeApprovedSourceIds, inactiveApprovedSourceIds, records };
    };

    let cursor = 0;
    const workers = Array.from({ length: BUSAN_LIVE_LIMITS.sourceConcurrency }, async () => {
      while (cursor < sourceKeys.length) { const source = sourceKeys[cursor++]; sourceResults[source] = await runSource(source); }
    });
    await Promise.all(workers);
    const readyCount = sourceKeys.filter((source) => sourceResults[source].status === 'ready').length;
    const status = readyCount === sourceKeys.length ? 'ready' : readyCount === 0 ? 'unavailable' : 'partial';
    return json({ status, liveSourceSnapshotId: input.liveSourceSnapshotId, providerCalls: budget.used(), sources: sourceResults });
  };
}
