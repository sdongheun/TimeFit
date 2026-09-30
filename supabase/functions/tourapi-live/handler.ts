import type { LiveProviderBudgetDecision } from '../_shared/liveProviderBudget';

export const TOUR_LIVE_CONTENT_TYPES = Object.freeze(['12', '14', '28', '38', '39'] as const);
const tourLiveContentTypeSet = new Set<string>(TOUR_LIVE_CONTENT_TYPES);

export const TOUR_LIVE_LIMITS = Object.freeze({
  listPagesPerType: 2, catalogContentTypes: TOUR_LIVE_CONTENT_TYPES.length, catalogConcurrency: 3, catalogCandidateLimit: 500, initialDetailBatch: 12, supplementalDetailBatch: 6,
  detailRequests: 30, detailCommonRequests: 4, detailImageRequests: 1, detailConcurrency: 3,
  listTimeoutMs: 4000, detailTimeoutMs: 3000, automaticRetries: 0,
});

type Operation = 'areaBasedList2' | 'detailIntro2';
type FailureCode = 'timeout' | 'network' | 'http_error' | 'provider_error' | 'unauthorized' | 'rate_limited' | 'invalid_response' | 'page_limit' | 'request_budget_exhausted' | 'identity_conflict';
type Failure = Readonly<{ operation: Operation; code: FailureCode; status: number | null }>;
type Candidate = Readonly<{ contentId: string; contentTypeId: string }>;
type SessionState = Readonly<{ version: 1; snapshotId: string; activeKeys: readonly string[]; requestedKeys: readonly string[]; detailCommonUsed: number; detailImageUsed: number }>;
type SessionCodec = Readonly<{ encode(value: SessionState): Promise<string>; decode(token: string): Promise<SessionState | null> }>;
type Deps = Readonly<{ fetch: typeof fetch; authenticate: (token: string) => Promise<boolean>; serviceKey: string; reserveProviderAttempt?: (operation: 'catalog_page' | 'detail_intro') => Promise<LiveProviderBudgetDecision>; nowIso?: () => string; randomId?: () => string; timeoutSignal?: (milliseconds: number) => AbortSignal; sessionCodec?: SessionCodec }>;

const endpoint = 'https://apis.data.go.kr/B551011/KorService2';
const safeHeaders = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: safeHeaders });
const failure = (operation: Operation, code: FailureCode, status: number | null = null): Failure => ({ operation, code, status });
const unavailable = (reason: Failure, status = 200) => json({ status: 'unavailable', reason }, status);
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const finite = (value: unknown) => { const number = Number(value); return Number.isFinite(number) ? number : null; };
const keyOf = (value: Candidate) => `${value.contentId}:${value.contentTypeId}`;

function bearer(request: Request) { const value = request.headers.get('Authorization') ?? ''; return value.startsWith('Bearer ') ? value.slice(7).trim() : ''; }
function parseCandidates(value: unknown, rawLimit: number): Candidate[] | null {
  if (!Array.isArray(value) || value.length > rawLimit) return null;
  const result: Candidate[] = []; const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>; if (Object.keys(row).length !== 2) return null;
    const contentId = text(row.contentId); const contentTypeId = text(row.contentTypeId);
    if (!/^\d{1,20}$/.test(contentId) || !tourLiveContentTypeSet.has(contentTypeId)) return null;
    const candidate = { contentId, contentTypeId }; const key = keyOf(candidate); if (!seen.has(key)) { seen.add(key); result.push(candidate); }
  }
  return result;
}
function parseCatalogInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null; const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(',') !== 'action,approvedCandidates' || record.action !== 'catalog') return null;
  const approvedCandidates = parseCandidates(record.approvedCandidates, TOUR_LIVE_LIMITS.catalogCandidateLimit);
  return approvedCandidates ? { action: 'catalog' as const, approvedCandidates } : null;
}
function parseDetailInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null; const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(',') !== 'action,budgetToken,candidates,liveSourceSnapshotId' || record.action !== 'detail_batch') return null;
  const candidates = parseCandidates(record.candidates, TOUR_LIVE_LIMITS.detailRequests * 2); const liveSourceSnapshotId = text(record.liveSourceSnapshotId); const budgetToken = text(record.budgetToken);
  return candidates && candidates.length > 0 && liveSourceSnapshotId && budgetToken ? { action: 'detail_batch' as const, candidates, liveSourceSnapshotId, budgetToken } : null;
}
function timeoutCode(error: unknown): FailureCode { return error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'network'; }
function providerFailure(operation: Operation, status: number) { if (status === 401 || status === 403) return failure(operation, 'unauthorized', status); if (status === 429) return failure(operation, 'rate_limited', status); return failure(operation, 'http_error', status); }
function providerBody(raw: unknown) {
  if (!raw || typeof raw !== 'object') return null; const response = (raw as Record<string, unknown>).response; if (!response || typeof response !== 'object') return null;
  const header = (response as Record<string, unknown>).header; const body = (response as Record<string, unknown>).body;
  if (!header || typeof header !== 'object' || text((header as Record<string, unknown>).resultCode) !== '0000' || !body || typeof body !== 'object') return null;
  const bodyRecord = body as Record<string, unknown>; const totalCount = finite(bodyRecord.totalCount); const itemsNode = bodyRecord.items;
  const item = itemsNode && typeof itemsNode === 'object' ? (itemsNode as Record<string, unknown>).item : []; const items = Array.isArray(item) ? item : item && typeof item === 'object' ? [item] : [];
  return totalCount !== null && totalCount >= 0 ? { totalCount, items } : null;
}
function providerResultCode(raw: unknown) { if (!raw || typeof raw !== 'object') return ''; const response = (raw as Record<string, unknown>).response; if (!response || typeof response !== 'object') return ''; const header = (response as Record<string, unknown>).header; return header && typeof header === 'object' ? text((header as Record<string, unknown>).resultCode) : ''; }

const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
const decode64url = (value: string) => { const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4); return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)); };
function validSessionState(value: unknown): value is SessionState {
  if (!value || typeof value !== 'object') return false; const state = value as SessionState;
  return state.version === 1 && !!text(state.snapshotId) && Array.isArray(state.activeKeys) && state.activeKeys.every((key) => typeof key === 'string') && new Set(state.activeKeys).size === state.activeKeys.length
    && Array.isArray(state.requestedKeys) && state.requestedKeys.every((key) => typeof key === 'string') && new Set(state.requestedKeys).size === state.requestedKeys.length && state.requestedKeys.every((key) => state.activeKeys.includes(key))
    && Number.isInteger(state.detailCommonUsed) && state.detailCommonUsed >= 0 && state.detailCommonUsed <= TOUR_LIVE_LIMITS.detailCommonRequests && Number.isInteger(state.detailImageUsed) && state.detailImageUsed >= 0 && state.detailImageUsed <= TOUR_LIVE_LIMITS.detailImageRequests;
}
function createSessionCodec(secret: string): SessionCodec {
  const encoder = new TextEncoder();
  const keyPromise = crypto.subtle.digest('SHA-256', encoder.encode(`timefit-tourapi-session-v1:${secret}`)).then((material) => crypto.subtle.importKey('raw', material, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']));
  return {
    async encode(value) { const payload = base64url(encoder.encode(JSON.stringify(value))); const key = await keyPromise; const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload))); return `${payload}.${base64url(signature)}`; },
    async decode(token) { const [payload, signature, extra] = token.split('.'); if (!payload || !signature || extra) return null; try { const key = await keyPromise; if (!(await crypto.subtle.verify('HMAC', key, decode64url(signature), encoder.encode(payload)))) return null; const parsed = JSON.parse(new TextDecoder().decode(decode64url(payload))); return validSessionState(parsed) ? parsed : null; } catch { return null; } },
  };
}

export function createTourApiLiveHandler(deps: Deps) {
  const signal = deps.timeoutSignal ?? ((milliseconds: number) => AbortSignal.timeout(milliseconds)); const codec = deps.sessionCodec ?? createSessionCodec(deps.serviceKey);
  const call = async (operation: Operation, parameters: Record<string, string>, timeoutMs: number): Promise<{ body?: { totalCount: number; items: unknown[] }; reason?: Failure }> => {
    let reservation: LiveProviderBudgetDecision = 'unavailable';
    try { reservation = await deps.reserveProviderAttempt?.(operation === 'areaBasedList2' ? 'catalog_page' : 'detail_intro') ?? 'unavailable'; } catch { /* no provider request without a confirmed grant */ }
    if (reservation !== 'granted') return { reason: failure(operation, 'request_budget_exhausted') };
    const url = new URL(`${endpoint}/${operation}`); const common = { serviceKey: deps.serviceKey, MobileOS: 'ETC', MobileApp: 'TimeFit', _type: 'json', ...parameters }; for (const [key, value] of Object.entries(common)) url.searchParams.set(key, value);
    let response: Response; try { response = await deps.fetch(url, { method: 'GET', signal: signal(timeoutMs), headers: { Accept: 'application/json' } }); } catch (error) { return { reason: failure(operation, timeoutCode(error)) }; }
    if (!response.ok) return { reason: providerFailure(operation, response.status) }; let raw: unknown; try { raw = await response.json(); } catch { return { reason: failure(operation, 'invalid_response') }; }
    const resultCode = providerResultCode(raw); if (resultCode && resultCode !== '0000') return { reason: failure(operation, 'provider_error') }; const body = providerBody(raw); return body ? { body } : { reason: failure(operation, 'invalid_response') };
  };
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: safeHeaders }); if (request.method !== 'POST') return unavailable(failure('areaBasedList2', 'invalid_response'), 405);
    const token = bearer(request); if (!token || !(await deps.authenticate(token).catch(() => false))) return unavailable(failure('areaBasedList2', 'unauthorized', 401), 401); if (!deps.serviceKey) return unavailable(failure('areaBasedList2', 'unauthorized'));
    let rawInput: unknown; try { rawInput = await request.json(); } catch { return unavailable(failure('areaBasedList2', 'invalid_response'), 400); }
    const catalogInput = parseCatalogInput(rawInput);
    if (catalogInput) {
      const typeResults: Array<{ items?: Array<Record<string, unknown>>; reason?: Failure }> = new Array(TOUR_LIVE_CONTENT_TYPES.length); let typeCursor = 0;
      const typeWorker = async () => {
        while (typeCursor < TOUR_LIVE_CONTENT_TYPES.length) {
          const index = typeCursor++; const contentTypeId = TOUR_LIVE_CONTENT_TYPES[index]; const items: Array<Record<string, unknown>> = []; let expectedTotal = 0;
          for (let page = 1; page <= TOUR_LIVE_LIMITS.listPagesPerType; page += 1) {
            const result = await call('areaBasedList2', { lDongRegnCd: '26', contentTypeId, numOfRows: '1000', pageNo: String(page), arrange: 'Q' }, TOUR_LIVE_LIMITS.listTimeoutMs);
            if (result.reason || !result.body) { typeResults[index] = { reason: result.reason ?? failure('areaBasedList2', 'invalid_response') }; break; }
            if (page === 1) { expectedTotal = result.body.totalCount; if (expectedTotal > 1000 * TOUR_LIVE_LIMITS.listPagesPerType) { typeResults[index] = { reason: failure('areaBasedList2', 'page_limit') }; break; } }
            items.push(...result.body.items.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item)));
            if (items.length >= expectedTotal) { typeResults[index] = { items }; break; }
            if (page === TOUR_LIVE_LIMITS.listPagesPerType) typeResults[index] = { reason: failure('areaBasedList2', 'page_limit') };
          }
        }
      };
      await Promise.all(Array.from({ length: TOUR_LIVE_LIMITS.catalogConcurrency }, typeWorker));
      const failedType = typeResults.find((result) => result?.reason); if (failedType?.reason) return unavailable(failedType.reason);
      const active = typeResults.flatMap((result) => result?.items ?? []);
      const approved = new Map(catalogInput.approvedCandidates.map((item) => [keyOf(item), item])); const approvedContentIds = new Set(catalogInput.approvedCandidates.map((item) => item.contentId)); const activeContentIds = new Set<string>(); const exact = new Map<string, Record<string, unknown>>();
      for (const item of active) { const contentId = text(item.contentid); const contentTypeId = text(item.contenttypeid); const key = `${contentId}:${contentTypeId}`; if (contentId && contentTypeId) activeContentIds.add(contentId); if (approved.has(key)) exact.set(key, item); }
      const catalogPlaces: unknown[] = []; const activeKeys: string[] = []; const failures: Failure[] = [];
      const candidateStates = catalogInput.approvedCandidates.map((candidate) => {
        const key = keyOf(candidate); const item = exact.get(key); if (!item) { if (activeContentIds.has(candidate.contentId)) { failures.push(failure('areaBasedList2', 'identity_conflict')); return { ...candidate, state: 'identity_conflict' as const }; } return { ...candidate, state: 'inactive' as const }; }
        const lat = finite(item.mapy); const lon = finite(item.mapx); const title = text(item.title); if (lat === null || lon === null || !title || lat < -90 || lat > 90 || lon < -180 || lon > 180) return { ...candidate, state: 'active_catalog_failed' as const };
        activeKeys.push(key); catalogPlaces.push({ ...candidate, title, ...(text(item.addr1) ? { address: text(item.addr1) } : {}), lat, lon, ...(text(item.modifiedtime) ? { modifiedAt: text(item.modifiedtime) } : {}) }); return { ...candidate, state: 'active_catalog' as const };
      });
      if (candidateStates.some((item) => item.state === 'active_catalog_failed')) return unavailable(failure('areaBasedList2', 'invalid_response'));
      const snapshotId = deps.randomId?.() ?? crypto.randomUUID(); const session: SessionState = { version: 1, snapshotId, activeKeys, requestedKeys: [], detailCommonUsed: 0, detailImageUsed: 0 };
      const snapshot = { liveSourceSnapshotId: snapshotId, fetchedAt: deps.nowIso?.() ?? new Date().toISOString(), catalogPlaces, candidateStates, unreviewedCount: [...activeContentIds].filter((contentId) => !approvedContentIds.has(contentId)).length };
      return json({ kind: 'catalog', status: failures.length ? 'partial' : 'ready', snapshot, budgetToken: await codec.encode(session), ...(failures.length ? { failures } : {}) });
    }
    const detailInput = parseDetailInput(rawInput); if (!detailInput) return unavailable(failure('areaBasedList2', 'invalid_response'), 400);
    const session = await codec.decode(detailInput.budgetToken); if (!session || !validSessionState(session) || session.snapshotId !== detailInput.liveSourceSnapshotId) return unavailable(failure('detailIntro2', 'invalid_response'), 400);
    const activeKeys = new Set(session.activeKeys); const previouslyRequested = new Set(session.requestedKeys); if (detailInput.candidates.some((candidate) => !activeKeys.has(keyOf(candidate)))) return unavailable(failure('detailIntro2', 'invalid_response'), 400);
    const fresh = detailInput.candidates.filter((candidate) => !previouslyRequested.has(keyOf(candidate))); const batchLimit = session.requestedKeys.length === 0 ? TOUR_LIVE_LIMITS.initialDetailBatch : TOUR_LIVE_LIMITS.supplementalDetailBatch;
    if (fresh.length > batchLimit || session.requestedKeys.length + fresh.length > TOUR_LIVE_LIMITS.detailRequests) return unavailable(failure('detailIntro2', 'request_budget_exhausted'), 400);
    const details: unknown[] = new Array(fresh.length); const candidateStates: unknown[] = new Array(fresh.length); const failures: Failure[] = []; let cursor = 0;
    const worker = async () => { while (cursor < fresh.length) { const index = cursor++; const candidate = fresh[index]; const result = await call('detailIntro2', { contentId: candidate.contentId, contentTypeId: candidate.contentTypeId, numOfRows: '1', pageNo: '1' }, TOUR_LIVE_LIMITS.detailTimeoutMs);
      if (result.reason || !result.body || result.body.items.length !== 1 || !result.body.items[0] || typeof result.body.items[0] !== 'object') { failures.push(result.reason ?? failure('detailIntro2', 'invalid_response')); candidateStates[index] = { ...candidate, state: 'active_detail_failed' }; continue; }
      const intro = result.body.items[0] as Record<string, unknown>;
      if (text(intro.contentid) !== candidate.contentId || text(intro.contenttypeid) !== candidate.contentTypeId) { failures.push(failure('detailIntro2', 'invalid_response')); candidateStates[index] = { ...candidate, state: 'active_detail_failed' }; continue; }
      const openingText = text(intro.usetime) || text(intro.opentime) || text(intro.playtime) || text(intro.usetimefestival); const closedText = text(intro.restdate) || text(intro.restdateculture) || text(intro.restdateleports) || text(intro.restdatefood);
      details[index] = { ...candidate, opening: { ...(openingText ? { rawText: openingText } : {}), ...(closedText ? { closedText } : {}), ...(text(intro.eventstartdate) ? { eventStartDate: text(intro.eventstartdate) } : {}), ...(text(intro.eventenddate) ? { eventEndDate: text(intro.eventenddate) } : {}) } }; candidateStates[index] = { ...candidate, state: 'active_ready' };
    } };
    await Promise.all(Array.from({ length: Math.min(TOUR_LIVE_LIMITS.detailConcurrency, fresh.length) }, worker)); const requestedKeys = [...session.requestedKeys, ...fresh.map(keyOf)]; const updated: SessionState = { ...session, requestedKeys }; const remaining = TOUR_LIVE_LIMITS.detailRequests - requestedKeys.length; const nextBatchMax = remaining === 0 ? 0 : Math.min(requestedKeys.length === 0 ? TOUR_LIVE_LIMITS.initialDetailBatch : TOUR_LIVE_LIMITS.supplementalDetailBatch, remaining);
    return json({ kind: 'detail_batch', status: failures.length ? 'partial' : 'ready', liveSourceSnapshotId: session.snapshotId, details: details.filter(Boolean), candidateStates: candidateStates.filter(Boolean), failures, budget: { detailIntroUsed: requestedKeys.length, detailIntroRemaining: remaining, nextBatchMax, detailCommonRemaining: TOUR_LIVE_LIMITS.detailCommonRequests - session.detailCommonUsed, detailImageRemaining: TOUR_LIVE_LIMITS.detailImageRequests - session.detailImageUsed }, budgetToken: await codec.encode(updated) });
  };
}
