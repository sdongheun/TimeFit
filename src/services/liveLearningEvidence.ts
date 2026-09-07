import type { CourseCompletionStorage } from './courseCompletionRepository';

export const LIVE_LEARNING_EVIDENCE_PREFIX = '@timefit/live-learning-evidence-v1/';
export type LearningEvidenceProjectionV1 = Readonly<{
  schemaVersion: 1; courseRunId: string; evidenceRef: string; captureGeneration: number; publicationToken: string | null;
}>;
export type LearningEvidenceStopV1 = Readonly<{ stopId: string; stopOrdinal: 1 | 2; contentId: string }>;
export type LearningEvidencePublicationPort = Readonly<{
  storePrepared(projection: LearningEvidenceProjectionV1): Promise<LearningEvidenceProjectionV1>;
  activate(projection: LearningEvidenceProjectionV1): Promise<LearningEvidenceProjectionV1>;
}>;
export type LearningEvidenceExclusion = 'invalid_input' | 'not_found' | 'ineligible' | 'window_closed' | 'stale_generation'
  | 'not_published' | 'invalid_evidence' | 'not_first_arrival' | 'unsupported_source' | 'terminal' | 'completion_not_saved';
export type EvidenceFailure = Readonly<{ status: 'excluded'; reason: LearningEvidenceExclusion } | { status: 'conflict' | 'unavailable' }>;
export type PrepareLearningEvidenceResult = Readonly<{ status: 'prepared'; projection: LearningEvidenceProjectionV1 }> | EvidenceFailure;
export type AuthorizeLearningEvidenceResult = Readonly<{ status: 'authorized'; projection: LearningEvidenceProjectionV1 }> | EvidenceFailure;
export type PublishLearningEvidenceResult = Readonly<{ status: 'published'; projection: LearningEvidenceProjectionV1 }> | EvidenceFailure;
export type AcceptLearningEvidenceResult = Readonly<{ status: 'accepted' | 'already_accepted' }> | EvidenceFailure;
export type ConfirmationEvidenceInput = Readonly<{
  receipt: Readonly<{ courseRunId: string; stopId: string; eventId: string; baseRevision: number; type: string; source: string; evidence?: unknown }>;
  application: Readonly<{ courseRunId: string; stopId: string; stopOrdinal: 1 | 2; firstArrivalEventId: string; arrivalBaseRevision: number; source: string; outcome: 'applied' | 'replayed_first' | 'stale' }>;
}>;
export type AcceptedEvidenceStop = LearningEvidenceStopV1 & Readonly<{ eventId: string }>;
type Decision = Readonly<{ stopOrdinal: 1 | 2; eventId: string; baseRevision: number; source: string; status: 'accepted' | 'excluded'; reason: LearningEvidenceExclusion | null }>;
type ActiveEvidence = Readonly<{ schemaVersion: 1; projection: LearningEvidenceProjectionV1; stops: readonly LearningEvidenceStopV1[]; decisions: readonly Decision[] }>;
export type EvidenceRunInspection = Readonly<{ status: 'ready'; generation: number; existingOnly?: boolean }> | EvidenceFailure;

/** Shared production auth callback; refresh/repeated same-account SIGNED_IN is not an account transition. */
export function createLearningEvidenceAuthObserver(deps: Readonly<{
  setReady(ready: boolean): void;
  notifyChanged(): void;
  reconcile(subject: string | null): Promise<Readonly<{ status: string }>>;
}>) {
  let actor: string | null | undefined, revision = 0, ready = false;
  return (event: string, session: Readonly<{ user?: Readonly<{ id: string; is_anonymous?: boolean }> }> | null) => {
    const next = session?.user && !session.user.is_anonymous ? session.user.id : null;
    if (event === 'INITIAL_SESSION' || (next === actor && !ready && event === 'SIGNED_IN')) {
      const expected = ++revision; actor = next; ready = false; deps.setReady(false);
      void deps.reconcile(next).then(result => {
        if (expected === revision) { ready = result.status === 'ready'; deps.setReady(ready); }
      }, () => { if (expected === revision) deps.setReady(false); });
    } else if (next !== actor || event === 'SIGNED_OUT' || event === 'PASSWORD_RECOVERY') {
      ++revision; actor = next; ready = true; deps.setReady(true); deps.notifyChanged();
    }
  };
}
type Dependencies = Readonly<{
  storage: CourseCompletionStorage;
  inspect(courseRunId: string): Promise<EvidenceRunInspection>;
  reserve(courseRunId: string): Promise<EvidenceRunInspection>;
  closeWindow(courseRunId: string): Promise<Readonly<{ status: string }>>;
  fence(): number;
  createToken(): string;
}>;
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 200 && v.trim() === v;
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
const exclusionReasons: readonly LearningEvidenceExclusion[] = ['invalid_input', 'not_found', 'ineligible', 'window_closed', 'stale_generation',
  'not_published', 'invalid_evidence', 'not_first_arrival', 'unsupported_source', 'terminal', 'completion_not_saved'];
const excluded = (reason: LearningEvidenceExclusion): EvidenceFailure => ({ status: 'excluded', reason });
const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical((v as Record<string, unknown>)[k])])) : v;
const same = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const keys = (v: object, allowed: readonly string[]) => Object.keys(v).every(k => allowed.includes(k));
function isProjection(v: unknown): v is LearningEvidenceProjectionV1 {
  const p = v as LearningEvidenceProjectionV1;
  return Boolean(p && keys(p, ['schemaVersion', 'courseRunId', 'evidenceRef', 'captureGeneration', 'publicationToken']) && p.schemaVersion === 1
    && id(p.courseRunId) && uuid(p.evidenceRef) && integer(p.captureGeneration) && (p.publicationToken === null || uuid(p.publicationToken)));
}
function validStops(stops: readonly LearningEvidenceStopV1[]) {
  return Array.isArray(stops) && stops.length >= 1 && stops.length <= 2 && stops.every((s, i) => s && keys(s, ['stopId', 'stopOrdinal', 'contentId'])
    && id(s.stopId) && id(s.contentId) && s.stopOrdinal === i + 1) && new Set(stops.map(s => s.stopId)).size === stops.length;
}
function parse(raw: string): ActiveEvidence {
  const r = JSON.parse(raw) as ActiveEvidence;
  if (!r || !keys(r, ['schemaVersion', 'projection', 'stops', 'decisions']) || r.schemaVersion !== 1 || !isProjection(r.projection)
    || !validStops(r.stops) || !Array.isArray(r.decisions) || r.decisions.length > 2
    || new Set(r.decisions.map(d => d.stopOrdinal)).size !== r.decisions.length
    || !r.decisions.every(d => d && keys(d, ['stopOrdinal', 'eventId', 'baseRevision', 'source', 'status', 'reason'])
      && r.stops.some(s => s.stopOrdinal === d.stopOrdinal) && id(d.eventId) && integer(d.baseRevision)
      && ['app_action', 'live_activity_intent', 'unsupported'].includes(d.source)
      && (d.status === 'accepted' ? d.reason === null && r.projection.publicationToken !== null
        : d.status === 'excluded' && d.reason !== null && exclusionReasons.includes(d.reason)))) throw Error('evidence_corrupt');
  return r;
}
const queues = new WeakMap<object, Map<string, Promise<unknown>>>();
function serial<T>(storage: object, run: string, fn: () => Promise<T>): Promise<T> {
  let map = queues.get(storage); if (!map) { map = new Map(); queues.set(storage, map); }
  const next = (map.get(run) ?? Promise.resolve()).then(fn, fn);
  const settled = next.then(() => undefined, () => undefined); map.set(run, settled);
  void settled.then(() => { if (map!.get(run) === settled) map!.delete(run); });
  return next;
}

/** Optional storage has its own queue. Mandatory owner completion never waits for this queue. */
export function createLiveLearningEvidenceService(deps: Dependencies) {
  const cache = new Map<string, { record: ActiveEvidence; fence: number }>();
  const key = (run: string) => `${LIVE_LEARNING_EVIDENCE_PREFIX}${encodeURIComponent(run)}`;
  const read = async (run: string) => {
    const raw = await deps.storage.getItem(key(run)); if (raw === null) return null;
    const record = parse(raw); if (record.projection.courseRunId !== run) throw Error('evidence_run_mismatch');
    return record;
  };
  const write = (run: string, record: ActiveEvidence) => deps.storage.setItem(key(run), JSON.stringify(record));
  const token = () => { const value = deps.createToken(); if (!uuid(value)) throw Error('secure_random_unavailable'); return value; };
  const check = async (record: ActiveEvidence): Promise<EvidenceRunInspection> => {
    const run = await deps.inspect(record.projection.courseRunId);
    if (run.status !== 'ready') return run;
    return run.generation === record.projection.captureGeneration ? run : excluded('stale_generation');
  };
  const service = {
    forget(courseRunId?: string) { if (courseRunId) cache.delete(courseRunId); else cache.clear(); },
    takeAccepted(courseRunId: string, generation: number): readonly AcceptedEvidenceStop[] {
      const entry = cache.get(courseRunId); cache.delete(courseRunId);
      if (!entry || entry.fence !== deps.fence() || entry.record.projection.captureGeneration !== generation) return [];
      return entry.record.decisions.flatMap(d => d.status === 'accepted'
        ? [{ ...entry.record.stops.find(s => s.stopOrdinal === d.stopOrdinal)!, eventId: d.eventId }] : []);
    },
    async prepareRunLearningEvidence(input: Readonly<{ courseRunId: string; stops: readonly LearningEvidenceStopV1[] }>): Promise<PrepareLearningEvidenceResult> {
      if (!id(input?.courseRunId) || !validStops(input.stops)) return excluded('invalid_input');
      return serial(deps.storage, input.courseRunId, async () => {
        try {
          const fence = deps.fence(), run = await deps.reserve(input.courseRunId);
          if (run.status !== 'ready') return run;
          const existing = await read(input.courseRunId);
          if (existing) {
            const checked = await check(existing); if (checked.status !== 'ready') return checked;
            if (!same(existing.stops, input.stops)) return { status: 'conflict' };
            if (fence !== deps.fence()) return excluded('stale_generation');
            // A receipt may already have been acked before restart. Restore its durable decision, never recreate evidence.
            cache.set(input.courseRunId, { record: existing, fence });
            return { status: 'prepared', projection: { ...existing.projection, publicationToken: null } };
          }
          if (run.existingOnly) return excluded('window_closed');
          const record: ActiveEvidence = { schemaVersion: 1, projection: { schemaVersion: 1, courseRunId: input.courseRunId,
            evidenceRef: token(), captureGeneration: run.generation, publicationToken: null }, stops: input.stops.map(s => ({ ...s })), decisions: [] };
          await write(input.courseRunId, record);
          const checked = await check(record); if (checked.status !== 'ready') return checked;
          return fence === deps.fence() ? { status: 'prepared', projection: record.projection } : excluded('stale_generation');
        } catch { return { status: 'unavailable' }; }
      });
    },
    async confirmRunEvidencePublication(input: Readonly<{ projection: LearningEvidenceProjectionV1; nativePreparedAck: LearningEvidenceProjectionV1 }>): Promise<AuthorizeLearningEvidenceResult> {
      if (!isProjection(input?.projection) || input.projection.publicationToken !== null) return excluded('invalid_input');
      if (!same(input.projection, input.nativePreparedAck)) return { status: 'conflict' };
      return serial(deps.storage, input.projection.courseRunId, async () => {
        try {
          const fence = deps.fence(), record = await read(input.projection.courseRunId);
          if (!record) return excluded('not_found');
          const checked = await check(record); if (checked.status !== 'ready') return checked;
          if (!same({ ...record.projection, publicationToken: null }, input.projection)) return { status: 'conflict' };
          const projection = { ...record.projection, publicationToken: record.projection.publicationToken ?? token() };
          if (!record.projection.publicationToken) await write(projection.courseRunId, { ...record, projection });
          const after = await check(record); if (after.status !== 'ready') return after;
          return fence === deps.fence() ? { status: 'authorized', projection } : excluded('stale_generation');
        } catch { return { status: 'unavailable' }; }
      });
    },
    async publishRunLearningEvidence(input: Readonly<{ projection: LearningEvidenceProjectionV1 }>, port: LearningEvidencePublicationPort): Promise<PublishLearningEvidenceResult> {
      try {
        if (!isProjection(input?.projection)) return excluded('invalid_input');
        const ack = await port.storePrepared(input.projection);
        const result = await service.confirmRunEvidencePublication({ projection: input.projection, nativePreparedAck: ack });
        if (result.status !== 'authorized') return result;
        const activeAck = await port.activate(result.projection);
        if (!same(activeAck, result.projection)) return { status: 'conflict' };
        const run = await deps.inspect(result.projection.courseRunId);
        if (run.status !== 'ready') return run;
        return run.generation === result.projection.captureGeneration ? { status: 'published', projection: result.projection } : excluded('stale_generation');
      } catch { return { status: 'unavailable' }; }
    },
    async acceptConfirmationEvidence(input: ConfirmationEvidenceInput): Promise<AcceptLearningEvidenceResult> {
      const receipt = input?.receipt, app = input?.application;
      if (!receipt || !id(receipt.courseRunId) || !id(receipt.stopId) || !id(receipt.eventId) || !integer(receipt.baseRevision)) return excluded('invalid_input');
      return serial(deps.storage, receipt.courseRunId, async () => {
        try {
          const fence = deps.fence(), current = await deps.inspect(receipt.courseRunId);
          if (current.status !== 'ready') {
            if (current.status === 'excluded' && current.reason === 'terminal') {
              const closed = await deps.closeWindow(receipt.courseRunId);
              if (closed.status === 'unavailable') return { status: 'unavailable' };
            }
            return current;
          }
          const record = await read(receipt.courseRunId);
          if (!record) {
            const closed = await deps.closeWindow(receipt.courseRunId);
            return closed.status === 'unavailable' ? { status: 'unavailable' } : excluded('not_published');
          }
          const checked = await check(record); if (checked.status !== 'ready') return checked;
          const stop = record.stops.find(s => s.stopId === receipt.stopId);
          if (!stop) return { status: 'conflict' };
          if (record.decisions.some(d => d.eventId === receipt.eventId && d.stopOrdinal !== stop.stopOrdinal)) return { status: 'conflict' };
          const existing = record.decisions.find(d => d.stopOrdinal === stop.stopOrdinal);
          if (existing) {
            if (existing.eventId !== receipt.eventId || existing.baseRevision !== receipt.baseRevision
              || existing.source !== (['app_action', 'live_activity_intent'].includes(receipt.source) ? receipt.source : 'unsupported')) return { status: 'conflict' };
            if (existing.status === 'excluded') return excluded(existing.reason!);
          }
          let reason: LearningEvidenceExclusion | null = null;
          if (!app || app.outcome === 'stale' || !['applied', 'replayed_first'].includes(app.outcome)
            || app.courseRunId !== receipt.courseRunId || app.stopId !== receipt.stopId || app.stopOrdinal !== stop.stopOrdinal
            || app.firstArrivalEventId !== receipt.eventId || app.arrivalBaseRevision !== receipt.baseRevision || app.source !== receipt.source
            || receipt.type !== 'arrival_confirmed') reason = 'not_first_arrival';
          else if (!['app_action', 'live_activity_intent'].includes(receipt.source)) reason = 'unsupported_source';
          else if (!record.projection.publicationToken) reason = 'not_published';
          else {
            const evidence = receipt.evidence as LearningEvidenceProjectionV1;
            const projected = evidence && { ...evidence, courseRunId: evidence.courseRunId ?? receipt.courseRunId };
            if (!isProjection(projected) || !same(projected, record.projection)) reason = 'invalid_evidence';
          }
          if (existing && reason) return { status: 'conflict' };
          if (existing) {
            const after = await check(record); if (after.status !== 'ready') return after;
            if (fence !== deps.fence()) return excluded('stale_generation');
            cache.set(receipt.courseRunId, { record, fence }); return { status: 'already_accepted' };
          }
          const decision: Decision = { stopOrdinal: stop.stopOrdinal, eventId: receipt.eventId, baseRevision: receipt.baseRevision,
            source: ['app_action', 'live_activity_intent'].includes(receipt.source) ? receipt.source : 'unsupported', status: reason ? 'excluded' : 'accepted', reason };
          const updated = { ...record, decisions: [...record.decisions, decision] };
          await write(receipt.courseRunId, updated);
          const after = await check(record); if (after.status !== 'ready') return after;
          if (fence !== deps.fence()) return excluded('stale_generation');
          cache.set(receipt.courseRunId, { record: updated, fence });
          return reason ? excluded(reason) : { status: 'accepted' };
        } catch { return { status: 'unavailable' }; }
      });
    },
    async purgeRunLearningEvidence(input: Readonly<{ courseRunId: string }>): Promise<Readonly<{ status: 'purged' }> | EvidenceFailure> {
      if (!id(input?.courseRunId)) return excluded('invalid_input');
      cache.delete(input.courseRunId);
      return serial(deps.storage, input.courseRunId, async () => {
        try {
          const run = await deps.inspect(input.courseRunId);
          if (run.status === 'ready') return excluded('completion_not_saved');
          if (run.status === 'unavailable' || run.status === 'conflict') return run;
          await deps.storage.removeItem(key(input.courseRunId)); return { status: 'purged' };
        } catch { return { status: 'unavailable' }; }
      });
    },
  };
  return service;
}
