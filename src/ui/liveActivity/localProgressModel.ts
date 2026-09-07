export const LOCAL_PROGRESS_SCHEMA_VERSION = 1 as const;
const MINUTE_MS = 60_000;

export function safeLearningEvidence(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const p = value as Record<string, unknown>;
  if (Object.keys(p).some(k => !['schemaVersion', 'courseRunId', 'evidenceRef', 'captureGeneration', 'publicationToken'].includes(k))
    || p.schemaVersion !== 1 || typeof p.evidenceRef !== 'string' || typeof p.publicationToken !== 'string'
    || !Number.isSafeInteger(p.captureGeneration) || Number(p.captureGeneration) < 0
    || (p.courseRunId !== undefined && typeof p.courseRunId !== 'string')) return undefined;
  return { ...p };
}

export type LocalProgressPhase = 'idle' | 'traveling' | 'arrival_pending' | 'dwelling' | 'departure_due' | 'completed' | 'cancelled' | 'expired' | 'incomplete';
export type LocalProgressEventSource = 'app_handoff' | 'app_action' | 'live_activity_intent' | 'notification_action' | 'reconciliation';

export type LocalCourseStop = Readonly<{
  stopId: string;
  placeId: string;
  title: string;
  plannedStayMin: number;
}>;

export type LocalCourseSnapshot = Readonly<{
  courseRunId: string;
  finalArrivalAtMs: number;
  arrivalBufferMin: number;
  stops: readonly LocalCourseStop[];
}>;

export type LocalProgressStop = LocalCourseStop & Readonly<{
  firstArrival?: Readonly<{ eventId: string; baseRevision: number; source: LocalProgressEventSource; occurredAtMs: number; evidence?: unknown }>;
  arrivedAtMs: number | null;
  departedAtMs: number | null;
  snoozeUsed: boolean;
}>;

export type LocalProgressRoute = Readonly<{
  targetKind: 'visit_stop' | 'final_destination';
  targetStopId: string | null;
  targetTitle: string;
  moveMin: number;
  routeOpenedAtMs: number;
  arrivalPromptAtMs: number | null;
  nextBoundaryAtMs: number;
  departureReminderAtMs: number | null;
}>;

export type LocalProgressState = Readonly<{
  handoffPreparation?: Readonly<{ attemptId: string; travelStepIndex: number; baseRevision: number; baseStopId: string | null; created: boolean; status: 'pending' | 'failed' }>;
  schemaVersion: typeof LOCAL_PROGRESS_SCHEMA_VERSION;
  courseRunId: string;
  revision: number;
  phase: LocalProgressPhase;
  finalArrivalAtMs: number;
  arrivalBufferMin: number;
  activeStopId: string | null;
  route: LocalProgressRoute | null;
  stops: readonly LocalProgressStop[];
  processedEventIds: readonly string[];
  updatedAtMs: number;
  terminalAtMs: number | null;
}>;

export type HandoffSucceededEvent = Readonly<{
  eventId: string;
  source: LocalProgressEventSource;
  baseRevision: number;
  occurredAtMs: number;
  courseRunId: string;
  type: 'handoff_succeeded';
  targetKind: 'visit_stop' | 'final_destination';
  targetStopId: string | null;
  targetTitle: string;
  moveMin: number;
  departingStopId?: string | null;
  nextBoundaryAtMs?: number;
  departureReminderAtMs?: number | null;
}>;

type ArrivalConfirmedEvent = Readonly<{
  evidence?: unknown;
  eventId: string;
  source: LocalProgressEventSource;
  baseRevision: number;
  occurredAtMs: number;
  courseRunId: string;
  type: 'arrival_confirmed';
  stopId: string;
}>;

type ArrivalSnoozedEvent = Readonly<{
  eventId: string;
  source: LocalProgressEventSource;
  baseRevision: number;
  occurredAtMs: number;
  courseRunId: string;
  type: 'arrival_snoozed';
  stopId: string;
  nextBoundaryAtMs: number;
}>;

type DepartureConfirmedEvent = Readonly<{
  eventId: string;
  source: LocalProgressEventSource;
  baseRevision: number;
  occurredAtMs: number;
  courseRunId: string;
  type: 'departure_confirmed';
  stopId: string;
}>;

type TerminalEvent = Readonly<{
  eventId: string;
  source: LocalProgressEventSource;
  baseRevision: number;
  occurredAtMs: number;
  courseRunId: string;
  type: 'terminal';
  terminal: Extract<LocalProgressPhase, 'completed' | 'cancelled' | 'expired' | 'incomplete'>;
}>;

export type LocalProgressEvent = HandoffSucceededEvent | ArrivalConfirmedEvent | ArrivalSnoozedEvent | DepartureConfirmedEvent | TerminalEvent;

const finite = (value: number) => Number.isFinite(value);
const nonEmpty = (value: string | null | undefined): value is string => typeof value === 'string' && value.trim().length > 0;

export function arrivalGraceMin(moveMin: number): number {
  if (!finite(moveMin) || moveMin < 0) return 3;
  return Math.min(10, Math.max(3, Math.round(moveMin * 0.2)));
}

export function departureReminder(input: Readonly<{
  nowMs: number;
  finalArrivalAtMs: number;
  arrivalBufferMin: number;
  remainingMoveMin: number;
  laterStayMin: number;
}>): Readonly<{ kind: 'scheduled' | 'immediate'; atMs: number }> {
  const calculated = input.finalArrivalAtMs - (input.arrivalBufferMin + input.remainingMoveMin + input.laterStayMin + 5) * MINUTE_MS;
  return calculated <= input.nowMs ? { kind: 'immediate', atMs: input.nowMs } : { kind: 'scheduled', atMs: calculated };
}

export function snoozeArrivalPrompt(input: Readonly<{
  nowMs: number;
  currentPromptAtMs: number;
  nextBoundaryAtMs: number;
  snoozeUsed: boolean;
}>): Readonly<{ kind: 'scheduled'; atMs: number } | { kind: 'unavailable' }> {
  if (input.snoozeUsed) return { kind: 'unavailable' };
  const atMs = Math.max(input.nowMs, input.currentPromptAtMs) + 5 * MINUTE_MS;
  return atMs < input.nextBoundaryAtMs ? { kind: 'scheduled', atMs } : { kind: 'unavailable' };
}

function validSnapshot(snapshot: LocalCourseSnapshot): boolean {
  if (!nonEmpty(snapshot.courseRunId) || !finite(snapshot.finalArrivalAtMs) || !Number.isInteger(snapshot.arrivalBufferMin) || snapshot.arrivalBufferMin < 0 || snapshot.stops.length < 1 || snapshot.stops.length > 2) return false;
  const ids = new Set<string>();
  return snapshot.stops.every((stop) => {
    if (!nonEmpty(stop.stopId) || !stop.stopId.startsWith('stop:') || !nonEmpty(stop.placeId) || !nonEmpty(stop.title) || !Number.isInteger(stop.plannedStayMin) || stop.plannedStayMin < 0 || ids.has(stop.stopId)) return false;
    ids.add(stop.stopId);
    return true;
  });
}

export function buildLocalProgressState(snapshot: LocalCourseSnapshot, event: HandoffSucceededEvent): LocalProgressState {
  if (!validSnapshot(snapshot) || event.courseRunId !== snapshot.courseRunId || event.baseRevision !== 0 || event.targetKind !== 'visit_stop' || !event.targetStopId || !snapshot.stops.some((stop) => stop.stopId === event.targetStopId) || !nonEmpty(event.eventId) || !Number.isInteger(event.moveMin) || event.moveMin < 0) {
    throw new Error('invalid_local_progress_start');
  }
  return {
    schemaVersion: LOCAL_PROGRESS_SCHEMA_VERSION,
    courseRunId: snapshot.courseRunId,
    revision: 1,
    phase: 'traveling',
    finalArrivalAtMs: snapshot.finalArrivalAtMs,
    arrivalBufferMin: snapshot.arrivalBufferMin,
    activeStopId: event.targetStopId,
    route: {
      targetKind: event.targetKind,
      targetStopId: event.targetStopId,
      targetTitle: event.targetTitle,
      moveMin: event.moveMin,
      routeOpenedAtMs: event.occurredAtMs,
      arrivalPromptAtMs: event.occurredAtMs + (event.moveMin + arrivalGraceMin(event.moveMin)) * MINUTE_MS,
      nextBoundaryAtMs: event.nextBoundaryAtMs ?? snapshot.finalArrivalAtMs,
      departureReminderAtMs: event.departureReminderAtMs ?? null,
    },
    stops: snapshot.stops.map((stop) => ({ ...stop, arrivedAtMs: null, departedAtMs: null, snoozeUsed: false })),
    processedEventIds: [event.eventId],
    updatedAtMs: event.occurredAtMs,
    terminalAtMs: null,
  };
}

function eventCourseRunId(event: LocalProgressEvent, fallback: string): string {
  return event.courseRunId || fallback;
}

export function reduceLocalProgressEvent(state: LocalProgressState, event: LocalProgressEvent): Readonly<{ state: LocalProgressState; applied: boolean }> {
  if (!nonEmpty(event.eventId) || state.processedEventIds.includes(event.eventId) || eventCourseRunId(event, state.courseRunId) !== state.courseRunId || event.baseRevision !== state.revision || !finite(event.occurredAtMs) || state.terminalAtMs !== null) return { state, applied: false };
  let next: LocalProgressState | null = null;
  if (event.type === 'arrival_confirmed') {
    if ((state.phase !== 'traveling' && state.phase !== 'arrival_pending') || state.activeStopId !== event.stopId || !state.stops.some((stop) => stop.stopId === event.stopId)) return { state, applied: false };
    next = { ...state, phase: 'dwelling', stops: state.stops.map((stop) => stop.stopId === event.stopId && stop.arrivedAtMs === null ? { ...stop, arrivedAtMs: event.occurredAtMs,
      firstArrival: { eventId: event.eventId, baseRevision: event.baseRevision, source: event.source, occurredAtMs: event.occurredAtMs, evidence: safeLearningEvidence(event.evidence) } } : stop) };
  } else if (event.type === 'arrival_snoozed') {
    const activeStop = state.stops.find((stop) => stop.stopId === event.stopId);
    const currentPromptAtMs = state.route?.arrivalPromptAtMs;
    if ((state.phase !== 'traveling' && state.phase !== 'arrival_pending') || state.activeStopId !== event.stopId || !activeStop || currentPromptAtMs === null || currentPromptAtMs === undefined || !finite(event.nextBoundaryAtMs)) return { state, applied: false };
    const snooze = snoozeArrivalPrompt({ nowMs: event.occurredAtMs, currentPromptAtMs, nextBoundaryAtMs: event.nextBoundaryAtMs, snoozeUsed: activeStop.snoozeUsed });
    if (snooze.kind === 'unavailable' || !state.route) return { state, applied: false };
    next = {
      ...state,
      route: { ...state.route, arrivalPromptAtMs: snooze.atMs },
      stops: state.stops.map((stop) => stop.stopId === event.stopId ? { ...stop, snoozeUsed: true } : stop),
    };
  } else if (event.type === 'departure_confirmed') {
    if ((state.phase !== 'dwelling' && state.phase !== 'departure_due') || state.activeStopId !== event.stopId) return { state, applied: false };
    next = { ...state, phase: 'traveling', route: null, stops: state.stops.map((stop) => stop.stopId === event.stopId && stop.departedAtMs === null ? { ...stop, departedAtMs: event.occurredAtMs } : stop) };
  } else if (event.type === 'terminal') {
    next = { ...state, phase: event.terminal, terminalAtMs: event.occurredAtMs, route: null, activeStopId: null };
  } else if (event.type === 'handoff_succeeded') {
    const targetExists = event.targetKind === 'final_destination' || Boolean(event.targetStopId && state.stops.some((stop) => stop.stopId === event.targetStopId));
    if (!targetExists || !Number.isInteger(event.moveMin) || event.moveMin < 0) return { state, applied: false };
    let stops = state.stops;
    if (event.departingStopId) {
      if ((state.phase !== 'dwelling' && state.phase !== 'departure_due') || state.activeStopId !== event.departingStopId) return { state, applied: false };
      stops = stops.map((stop) => stop.stopId === event.departingStopId && stop.departedAtMs === null ? { ...stop, departedAtMs: event.occurredAtMs } : stop);
    }
    next = {
      ...state,
      phase: 'traveling',
      activeStopId: event.targetKind === 'visit_stop' ? event.targetStopId : null,
      route: {
        targetKind: event.targetKind,
        targetStopId: event.targetKind === 'visit_stop' ? event.targetStopId : null,
        targetTitle: event.targetTitle,
        moveMin: event.moveMin,
        routeOpenedAtMs: event.occurredAtMs,
        arrivalPromptAtMs: event.targetKind === 'visit_stop' ? event.occurredAtMs + (event.moveMin + arrivalGraceMin(event.moveMin)) * MINUTE_MS : null,
        nextBoundaryAtMs: event.nextBoundaryAtMs ?? state.finalArrivalAtMs,
        departureReminderAtMs: event.departureReminderAtMs ?? null,
      },
      stops,
    };
  } else {
    return { state, applied: false };
  }
  return {
    applied: true,
    state: { ...next, revision: state.revision + 1, processedEventIds: [...state.processedEventIds.slice(-63), event.eventId], updatedAtMs: event.occurredAtMs },
  };
}

type DecodeResult =
  | Readonly<{ kind: 'missing' }>
  | Readonly<{ kind: 'corrupt' }>
  | Readonly<{ kind: 'unsupported_version' }>
  | Readonly<{ kind: 'ready'; state: LocalProgressState }>
  | Readonly<{ kind: 'migrated'; state: LocalProgressState }>;

export function decodeLocalProgressState(raw: string | null): DecodeResult {
  if (raw === null) return { kind: 'missing' };
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return { kind: 'corrupt' }; }
  if (!value || typeof value !== 'object') return { kind: 'corrupt' };
  const record = value as Record<string, unknown>;
  if (record.schemaVersion === 0 && nonEmpty(record.runId as string) && Number.isInteger(record.revision) && Array.isArray(record.stops)) {
    return {
      kind: 'migrated',
      state: {
        schemaVersion: 1, courseRunId: record.runId as string, revision: record.revision as number,
        phase: record.phase === 'traveling' ? 'traveling' : 'idle', finalArrivalAtMs: 0, arrivalBufferMin: 0,
        activeStopId: null, route: null, stops: [], processedEventIds: [], updatedAtMs: 0, terminalAtMs: null,
      },
    };
  }
  if (record.schemaVersion !== 1) return { kind: 'unsupported_version' };
  const state = value as LocalProgressState;
  if (!nonEmpty(state.courseRunId) || !Number.isInteger(state.revision) || !Array.isArray(state.stops) || !Array.isArray(state.processedEventIds) || !finite(state.updatedAtMs)) return { kind: 'corrupt' };
  const stops = state.stops.map(stop => {
    const p = stop.firstArrival;
    if (!p) return stop;
    const { firstArrival: _invalid, ...without } = stop;
    if (!nonEmpty(p.eventId) || !Number.isSafeInteger(p.baseRevision) || p.baseRevision < 0 || p.baseRevision >= state.revision
      || p.occurredAtMs !== stop.arrivedAtMs || !['app_action', 'live_activity_intent', 'notification_action'].includes(p.source)) return without;
    return { ...without, firstArrival: { eventId: p.eventId, baseRevision: p.baseRevision, source: p.source, occurredAtMs: p.occurredAtMs, evidence: safeLearningEvidence(p.evidence) } };
  });
  return { kind: 'ready', state: { ...state, stops } };
}

export type LocalProgressStoragePort = Readonly<{ read: () => Promise<string | null>; write: (raw: string) => Promise<void>; clear: () => Promise<void> }>;
export type LocalProgressActivityPort = Readonly<{ start: (state: LocalProgressState) => Promise<void>; update: (state: LocalProgressState) => Promise<void>; end: (state: LocalProgressState) => Promise<void> }>;
export type LocalProgressNotificationPort = Readonly<{ scheduleArrival: (state: LocalProgressState) => Promise<void>; cancelOwned: (courseRunId: string) => Promise<void> }>;
export type LocalProgressHandoffPort = Readonly<{ open: () => Promise<boolean> }>;

export async function openRouteThenStartLocalProgress(input: Readonly<{
  handoff: LocalProgressHandoffPort;
  coordinator: ReturnType<typeof createLocalProgressCoordinator>;
  snapshot: LocalCourseSnapshot;
  event: HandoffSucceededEvent;
}>) {
  let opened = false;
  try { opened = await input.handoff.open(); } catch { /* 외부 전환 실패는 로컬 진행을 시작하지 않는다. */ }
  return input.coordinator.afterHandoff({ opened, snapshot: input.snapshot, event: input.event });
}

export function createLocalProgressCoordinator(dependencies: Readonly<{
  storage: LocalProgressStoragePort;
  activity: LocalProgressActivityPort;
  notification: LocalProgressNotificationPort;
}>) {
  let operation: Promise<unknown> = Promise.resolve();
  const run = <T>(work: () => Promise<T>): Promise<T> => {
    const next = operation.then(work, work);
    operation = next.then(() => undefined, () => undefined);
    return next;
  };
  return {
    afterHandoff(input: Readonly<{ opened: boolean; snapshot: LocalCourseSnapshot; event: HandoffSucceededEvent }>) {
      if (!input.opened) return Promise.resolve({ status: 'handoff_failed' as const });
      return run(async () => {
        const decoded = decodeLocalProgressState(await dependencies.storage.read());
        if (decoded.kind === 'corrupt' || decoded.kind === 'unsupported_version') return { status: 'storage_unreadable' as const };
        if ((decoded.kind === 'ready' || decoded.kind === 'migrated') && decoded.state.courseRunId !== input.snapshot.courseRunId && decoded.state.terminalAtMs === null) return { status: 'active_run_conflict' as const };
        if ((decoded.kind === 'ready' || decoded.kind === 'migrated') && decoded.state.processedEventIds.includes(input.event.eventId)) return { status: 'duplicate' as const };
        let state: LocalProgressState;
        try {
          if (decoded.kind === 'missing') {
            state = buildLocalProgressState(input.snapshot, input.event);
          } else {
            const reduced = reduceLocalProgressEvent(decoded.state, input.event);
            if (!reduced.applied) return { status: 'stale' as const };
            state = reduced.state;
          }
        } catch {
          return { status: 'invalid_snapshot' as const };
        }
        try { await dependencies.storage.write(JSON.stringify(state)); }
        catch { return { status: 'storage_failed' as const }; }
        let activityStarted = true;
        try { await dependencies.activity.start(state); } catch { activityStarted = false; }
        try { await dependencies.notification.scheduleArrival(state); } catch { /* Activity와 기존 진행을 차단하지 않는다. */ }
        return { status: activityStarted ? 'started' as const : 'started_without_activity' as const, state };
      });
    },
  };
}
