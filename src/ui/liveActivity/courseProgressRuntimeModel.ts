import type { ActiveVerifiedCourse } from '../activeVerifiedCourseModel';
import type { AcceptLearningEvidenceResult, ConfirmationEvidenceInput } from '../../services/liveLearningEvidence';
import type { VerifiedCourseProgressState, VerifiedCourseProgressStep } from '../recommendation/verifiedCourseProgressModel';
import {
  buildLocalProgressState,
  decodeLocalProgressState,
  departureReminder,
  reduceLocalProgressEvent,
  safeLearningEvidence,
  type HandoffSucceededEvent,
  type LocalCourseSnapshot,
  type LocalProgressActivityPort,
  type LocalProgressEvent,
  type LocalProgressState,
} from './localProgressModel';

const MINUTE_MS = 60_000;
const validText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export type LiveCourseRoutePlan = Readonly<{
  travelStepIndex: number;
  targetKind: 'visit_stop' | 'final_destination';
  targetStopId: string | null;
  targetTitle: string;
  moveMin: number;
  arrivalPromptAtMs: number | null;
  nextBoundaryAtMs: number;
  departureReminderAtMs: number | null;
}>;

export type LiveCoursePlan = Readonly<{
  courseRunId: string;
  snapshot: LocalCourseSnapshot;
  routes: readonly LiveCourseRoutePlan[];
}>;

export type LiveCourseProgressStoragePort = Readonly<{
  read: () => Promise<string | null>;
  write: (raw: string) => Promise<void>;
  clear: () => Promise<void>;
  listReceipts: () => Promise<readonly Readonly<{ receiptId: string; raw: string }>[]>;
  acknowledgeReceipt: (receiptId: string) => Promise<void>;
}>;

export type LiveCourseProgressNotificationPort = Readonly<{
  sync: (state: LocalProgressState) => Promise<void>;
  cancelOwned: (courseRunId: string) => Promise<void>;
}>;

export type LiveCourseProgressDependencies = Readonly<{
  learning?: Readonly<{
    capture(courseRunId: string): unknown;
    consume(input: ConfirmationEvidenceInput): Promise<AcceptLearningEvidenceResult>;
    restore?(state: LocalProgressState): Promise<unknown>;
    close?(courseRunId: string, reason: 'completed' | 'cancelled' | 'expired'): Promise<unknown>;
  }>;
  onConfirmedArrival?: (input: { courseRunId: string; stopOrdinal: 1 | 2; confirmationEventId: string }) => void;
  storage: LiveCourseProgressStoragePort;
  activity: LocalProgressActivityPort;
  notification: LiveCourseProgressNotificationPort;
  cleanup?: Readonly<{
    prepare: (courseRunId: string) => Promise<Readonly<{ status: string }>>;
    retry: (courseRunId: string) => Promise<Readonly<{ status: 'clean' | 'pending' | 'storage_unreadable' }>>;
  }>;
  diagnostic?: (value: Readonly<{ action: 'receipt'; attemptId: string; stage: string; result: 'started' | 'succeeded' | 'rejected' | 'failed' | 'observed' | 'absent'; error?: 'none' | 'storage_unreadable' | 'receipt_rejected'; phase?: string; revision?: number }>) => void;
}>;

function stopId(index: number, placeId: string) { return `stop:${index}:${placeId}`; }

export function buildLiveCoursePlan(
  active: ActiveVerifiedCourse,
  steps: readonly VerifiedCourseProgressStep[],
): Readonly<{ status: 'ready'; plan: LiveCoursePlan; snapshot: LocalCourseSnapshot; routes: readonly LiveCourseRoutePlan[] } | { status: 'invalid_snapshot' }> {
  const { course, session } = active;
  const startAtMs = Date.parse(session.nowIso);
  if (!validText(active.courseRunId) || !Number.isFinite(startAtMs) || !Number.isInteger(session.remainingMin) || session.remainingMin <= 0
    || !Number.isInteger(session.arrivalBufferMin) || session.arrivalBufferMin < 0 || course.stops.length < 1 || course.stops.length > 2
    || steps.length !== course.stops.length * 2 + 1) return { status: 'invalid_snapshot' };
  const finalArrivalAtMs = startAtMs + session.remainingMin * MINUTE_MS;
  const stops = course.stops.map((stop, index) => {
    const travel = steps[index * 2];
    const stay = steps[index * 2 + 1];
    if (course.placeIds[index] !== stop.placeId || travel?.kind !== 'travel' || stay?.kind !== 'stay' || stay.target.id !== stop.placeId
      || !Number.isInteger(stop.stayMin) || stop.stayMin < 0) return null;
    return { stopId: stopId(index, stop.placeId), placeId: stop.placeId, title: stay.target.label, plannedStayMin: stop.stayMin };
  });
  if (stops.some(value => value === null)) return { status: 'invalid_snapshot' };
  const snapshot: LocalCourseSnapshot = {
    courseRunId: active.courseRunId,
    finalArrivalAtMs,
    arrivalBufferMin: session.arrivalBufferMin,
    stops: stops as LocalCourseSnapshot['stops'],
  };
  const routes: LiveCourseRoutePlan[] = [];
  for (let index = 0; index < steps.length; index += 2) {
    const travel = steps[index];
    if (!travel || travel.kind !== 'travel' || !Number.isInteger(travel.min) || travel.min < 0) return { status: 'invalid_snapshot' };
    const stopIndex = index / 2;
    const targetStop = snapshot.stops[stopIndex] ?? null;
    const remainingMoveMin = steps.slice(index + 1).filter((step): step is Extract<VerifiedCourseProgressStep, { kind: 'travel' }> => step.kind === 'travel').reduce((sum, step) => sum + step.min, 0);
    const laterStayMin = snapshot.stops.slice(stopIndex + 1).reduce((sum, stop) => sum + stop.plannedStayMin, 0);
    const reminder = targetStop ? departureReminder({ nowMs: startAtMs, finalArrivalAtMs, arrivalBufferMin: session.arrivalBufferMin, remainingMoveMin, laterStayMin }) : null;
    routes.push({
      travelStepIndex: index,
      targetKind: targetStop ? 'visit_stop' : 'final_destination',
      targetStopId: targetStop?.stopId ?? null,
      targetTitle: travel.target.label,
      moveMin: travel.min,
      arrivalPromptAtMs: targetStop ? startAtMs + (travel.min + Math.min(10, Math.max(3, Math.round(travel.min * .2)))) * MINUTE_MS : null,
      nextBoundaryAtMs: reminder ? reminder.atMs + 5 * MINUTE_MS : finalArrivalAtMs,
      departureReminderAtMs: reminder?.atMs ?? null,
    });
  }
  const plan: LiveCoursePlan = { courseRunId: active.courseRunId, snapshot, routes };
  return { status: 'ready', plan, snapshot, routes };
}

function parseReceipt(raw: string): LocalProgressEvent | null {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (value.schemaVersion !== 1 || value.purpose !== 'course_progress' || !validText(value.courseRunId) || !validText(value.eventId)
      || !validText(value.stopId) || !Number.isInteger(value.baseRevision) || typeof value.occurredAtMs !== 'number'
      || !['arrival_confirmed', 'arrival_snoozed', 'departure_confirmed'].includes(String(value.type))) return null;
    const common = {
      courseRunId: value.courseRunId, eventId: value.eventId, stopId: value.stopId,
      baseRevision: value.baseRevision as number, occurredAtMs: value.occurredAtMs,
      source: value.source === 'notification_action' ? 'notification_action' as const : value.source === 'app_action' ? 'app_action' as const : value.source === 'live_activity_intent' ? 'live_activity_intent' as const : 'reconciliation' as const,
    };
    if (value.type === 'arrival_snoozed') {
      if (typeof value.nextBoundaryAtMs !== 'number') return null;
      return { ...common, type: 'arrival_snoozed', nextBoundaryAtMs: value.nextBoundaryAtMs };
    }
    return { ...common, type: value.type as 'arrival_confirmed' | 'departure_confirmed', evidence: safeLearningEvidence(value.evidence) };
  } catch { return null; }
}

function actualDwell(state: LocalProgressState): Record<string, number> {
  return Object.fromEntries(state.stops.flatMap(stop => stop.arrivedAtMs !== null && stop.departedAtMs !== null
    && Number.isFinite(stop.arrivedAtMs) && Number.isFinite(stop.departedAtMs) && stop.departedAtMs >= stop.arrivedAtMs
    ? [[stop.placeId, Math.min(1440, Math.max(0, Math.floor((stop.departedAtMs - stop.arrivedAtMs) / MINUTE_MS)))]] : []));
}

export function projectVerifiedProgressFromLocal(state: LocalProgressState, plan?: LiveCoursePlan): VerifiedCourseProgressState {
  if (state.phase === 'completed') return { stepIndex: plan?.routes.at(-1)?.travelStepIndex ?? state.stops.length * 2, routeOpened: true, finished: true };
  if ((state.phase === 'dwelling' || state.phase === 'departure_due') && state.activeStopId) {
    const stopIndex = state.stops.findIndex(stop => stop.stopId === state.activeStopId);
    if (stopIndex >= 0) return { stepIndex: stopIndex * 2 + 1, routeOpened: false, finished: false };
  }
  if (state.phase === 'traveling' && !state.route && state.activeStopId) {
    const stopIndex = state.stops.findIndex(stop => stop.stopId === state.activeStopId && stop.departedAtMs !== null);
    if (stopIndex >= 0) return { stepIndex: stopIndex * 2 + 1, routeOpened: false, finished: false };
  }
  if (state.route) {
    const stopIndex = state.route.targetKind === 'final_destination' ? state.stops.length : state.stops.findIndex(stop => stop.stopId === state.route?.targetStopId);
    const routeIndex = plan?.routes.find(item => item.targetKind === state.route?.targetKind && item.targetStopId === state.route?.targetStopId)?.travelStepIndex;
    if (routeIndex !== undefined || stopIndex >= 0) return { stepIndex: routeIndex ?? stopIndex * 2, routeOpened: true, finished: false };
  }
  return { stepIndex: 0, routeOpened: false, finished: false };
}

export function createLiveCourseProgressController(dependencies: LiveCourseProgressDependencies) {
  let tail: Promise<unknown> = Promise.resolve();
  const serial = <T>(work: () => Promise<T>) => {
    const result = tail.then(work, work); tail = result.then(() => undefined, () => undefined); return result;
  };
  const read = async () => {
    const decoded = decodeLocalProgressState(await dependencies.storage.read());
    if (decoded.kind === 'corrupt' || decoded.kind === 'unsupported_version') throw new Error('live_progress_storage_unreadable');
    return decoded.kind === 'ready' || decoded.kind === 'migrated' ? decoded.state : null;
  };
  const persistUpdate = async (state: LocalProgressState, start: boolean) => {
    await dependencies.storage.write(JSON.stringify(state));
    let activityOk = true;
    try { if (start) await dependencies.activity.start(state); else await dependencies.activity.update(state); } catch { activityOk = false; }
    try { await dependencies.notification.sync(state); } catch { /* 권한 거절·예약 실패는 진행을 막지 않는다. */ }
    return activityOk;
  };
  const consuming = new Map<string, Promise<void>>();
  const consume = (state: LocalProgressState, event: LocalProgressEvent, applied: boolean, receiptId?: string) => {
    if (!dependencies.learning || event.type !== 'arrival_confirmed') {
      if (receiptId) void dependencies.storage.acknowledgeReceipt(receiptId).catch(() => undefined);
      return;
    }
    const index = state.stops.findIndex(s => s.stopId === event.stopId), first = state.stops[index]?.firstArrival;
    const exact = first && first.eventId === event.eventId && first.baseRevision === event.baseRevision && first.source === event.source;
    if (!exact) {
      // A reducer-rejected competitor never replaces/poisons the durable first arrival.
      if (receiptId && event.baseRevision <= state.revision) void dependencies.storage.acknowledgeReceipt(receiptId).catch(() => undefined);
      return;
    }
    const key = `${state.courseRunId}:${event.eventId}:${receiptId ?? 'app'}`;
    if (consuming.has(key)) return;
    const work = (async () => {
      await dependencies.learning!.restore?.(state);
      const result = await dependencies.learning!.consume({ receipt: event, application: {
        courseRunId: state.courseRunId, stopId: event.stopId, stopOrdinal: (index + 1) as 1 | 2,
        firstArrivalEventId: first.eventId, arrivalBaseRevision: first.baseRevision, source: first.source,
        outcome: applied ? 'applied' : 'replayed_first',
      } });
      if (receiptId && ['accepted', 'already_accepted', 'excluded'].includes(result.status)) await dependencies.storage.acknowledgeReceipt(receiptId);
    })().catch(() => undefined).finally(() => consuming.delete(key));
    consuming.set(key, work);
  };
  const replayFirst = (state: LocalProgressState) => {
    for (const stop of state.stops) if (stop.firstArrival) consume(state, { ...stop.firstArrival, courseRunId: state.courseRunId, stopId: stop.stopId, type: 'arrival_confirmed' }, false);
  };
  const apply = async (state: LocalProgressState, event: LocalProgressEvent) => {
    const reduced = reduceLocalProgressEvent(state, event);
    if (!reduced.applied) return { status: 'stale' as const, state };
    await persistUpdate(reduced.state, false);
    consume(reduced.state, event, true);
    // Reconciled native receipts cannot prove historical account/consent eligibility.
    if (!dependencies.learning && event.type === 'arrival_confirmed' && event.source === 'app_action') {
      const ordinal = state.stops.findIndex(stop => stop.stopId === event.stopId) + 1;
      try { if (ordinal === 1 || ordinal === 2) dependencies.onConfirmedArrival?.({ courseRunId: event.courseRunId, stopOrdinal: ordinal, confirmationEventId: event.eventId }); }
      catch { /* Optional personalization never prevents confirmed progress. */ }
    }
    return { status: 'updated' as const, state: reduced.state };
  };
  const cleanupTerminal = async (state: LocalProgressState) => {
    void dependencies.learning?.close?.(state.courseRunId, state.phase === 'completed' ? 'completed' : state.phase === 'cancelled' ? 'cancelled' : 'expired').catch(() => undefined);
    if (dependencies.cleanup) {
      const prepared = await dependencies.cleanup.prepare(state.courseRunId);
      if (prepared.status === 'storage_unreadable') return false;
      return (await dependencies.cleanup.retry(state.courseRunId)).status === 'clean';
    }
    let activityEnded = true; let notificationsCancelled = true;
    try { await dependencies.activity.end(state); } catch { activityEnded = false; }
    try { await dependencies.notification.cancelOwned(state.courseRunId); } catch { notificationsCancelled = false; }
    return activityEnded && notificationsCancelled;
  };

  // Native receipts may arrive while JS is suspended in the external application.
  // Apply those confirmations before deciding whether a preparation still owns state.
  const receive = async (state: LocalProgressState) => {
    const receipts = (await dependencies.storage.listReceipts()).map(item => ({ ...item, event: parseReceipt(item.raw) }))
      .filter(item => item.event?.courseRunId === state.courseRunId)
      .sort((a, b) => a.event!.baseRevision - b.event!.baseRevision);
    for (const item of receipts) {
      const reduced = reduceLocalProgressEvent(state, item.event!);
      if (reduced.applied) { state = reduced.state; await persistUpdate(state, false); }
      if (item.event!.baseRevision <= state.revision) consume(state, item.event!, reduced.applied, item.receiptId);
    }
    return state;
  };

  return {
    prepareHandoff(input: Readonly<{ plan: LiveCoursePlan; travelStepIndex: number; occurredAtMs: number; eventId: string }>) {
      return serial(async () => {
        const route = input.plan.routes.find(item => item.travelStepIndex === input.travelStepIndex);
        if (!route || !validText(input.eventId)) return { status: 'invalid_snapshot' as const };
        let current: LocalProgressState | null;
        try { current = await read(); if (current) current = await receive(current); }
        catch { return { status: 'storage_unreadable' as const }; }
        if (current && (current.courseRunId !== input.plan.courseRunId || current.terminalAtMs !== null)) return { status: 'active_run_conflict' as const };
        if (current?.handoffPreparation?.attemptId === input.eventId) return { status: 'prepared' as const, state: current };
        if (!current && (input.travelStepIndex !== 0 || !route.targetStopId)) return { status: 'invalid_snapshot' as const };
        const previous = current?.handoffPreparation;
        const unchangedPreparation = previous && current?.revision === previous.baseRevision && current.activeStopId === previous.baseStopId;
        const created = unchangedPreparation ? previous.created : !current;
        const base: LocalProgressState = current ?? {
          schemaVersion: 1, courseRunId: input.plan.courseRunId, revision: 1, phase: 'traveling',
          finalArrivalAtMs: input.plan.snapshot.finalArrivalAtMs, arrivalBufferMin: input.plan.snapshot.arrivalBufferMin,
          activeStopId: route.targetStopId, route: null,
          stops: input.plan.snapshot.stops.map(stop => ({ ...stop, arrivedAtMs: null, departedAtMs: null, snoozeUsed: false })),
          processedEventIds: [], updatedAtMs: input.occurredAtMs, terminalAtMs: null,
        };
        const state: LocalProgressState = { ...base, handoffPreparation: { attemptId: input.eventId, travelStepIndex: input.travelStepIndex,
          baseRevision: base.revision, baseStopId: base.activeStopId, created, status: 'pending' } };
        await dependencies.storage.write(JSON.stringify(state));
        let activityOk = true;
        // Existing progress remains untouched. Preparation never schedules success notifications.
        if (!current || (created && previous?.status === 'failed')) { try { await dependencies.activity.start(state); } catch { activityOk = false; } }
        return { status: activityOk ? 'prepared' as const : 'prepared_without_activity' as const, state };
      });
    },
    settleHandoff(input: Readonly<{ opened: boolean; plan: LiveCoursePlan; travelStepIndex: number; occurredAtMs: number; eventId: string }>) {
      return serial(async () => {
        let current: LocalProgressState | null;
        try { current = await read(); if (current) current = await receive(current); }
        catch { return { status: 'storage_unreadable' as const }; }
        const preparation = current?.handoffPreparation;
        if (!current || current.courseRunId !== input.plan.courseRunId || !preparation || preparation.attemptId !== input.eventId
          || preparation.travelStepIndex !== input.travelStepIndex || preparation.status !== 'pending') return { status: 'stale' as const };
        const { handoffPreparation: _preparation, ...base } = current;
        const route = input.plan.routes.find(item => item.travelStepIndex === input.travelStepIndex);
        if (!route) return { status: 'invalid_snapshot' as const };
        const event: HandoffSucceededEvent = {
          ...route, type: 'handoff_succeeded', source: 'app_handoff', courseRunId: input.plan.courseRunId,
          baseRevision: base.revision, occurredAtMs: input.occurredAtMs, eventId: input.eventId,
          departingStopId: base.phase === 'dwelling' || base.phase === 'departure_due' ? base.activeStopId : null,
        };
        const owns = current.revision === preparation.baseRevision && current.activeStopId === preparation.baseStopId && current.terminalAtMs === null;
        if (!owns) {
          // Arrival can be confirmed while the external Promise is still suspended.
          // Commit the now-observed incoming route, never turn that arrival into a departure.
          if (input.opened && !base.route && base.activeStopId === route.targetStopId && (base.phase === 'dwelling' || base.phase === 'departure_due')) {
            const reduced = reduceLocalProgressEvent(base, { ...event, departingStopId: null });
            if (reduced.applied) {
              const confirmed = { ...reduced.state, phase: base.phase, activeStopId: base.activeStopId, stops: base.stops };
              await persistUpdate(confirmed, false);
              return { status: 'confirmation_preserved' as const, state: confirmed };
            }
          }
          await dependencies.storage.write(JSON.stringify(base)); return { status: 'confirmation_preserved' as const, state: base };
        }
        if (!input.opened) {
          if (preparation.created) {
            const failed: LocalProgressState = { ...current, handoffPreparation: { ...preparation, status: 'failed' } };
            await dependencies.storage.write(JSON.stringify(failed));
            try { await dependencies.activity.end(failed); } catch { /* Durable preparation remains retryable. */ }
            // Keep the non-success base even after ending the Activity: an in-flight
            // native receipt can arrive after this read and must remain recoverable cold.
            const latest = await receive(failed);
            return { status: latest.revision === failed.revision ? 'preparation_retained' as const : 'confirmation_preserved' as const, state: latest };
          } else await dependencies.storage.write(JSON.stringify(base));
          return { status: 'rolled_back' as const };
        }
        return apply(base, event);
      });
    },
    afterHandoff(input: Readonly<{ opened: boolean; plan: LiveCoursePlan; travelStepIndex: number; occurredAtMs: number; eventId: string }>) {
      if (!input.opened) return Promise.resolve({ status: 'handoff_failed' as const });
      return serial(async () => {
        const route = input.plan.routes.find(item => item.travelStepIndex === input.travelStepIndex);
        if (!route) return { status: 'invalid_snapshot' as const };
        let current: LocalProgressState | null;
        try { current = await read(); } catch { return { status: 'storage_unreadable' as const }; }
        if (current && current.courseRunId !== input.plan.courseRunId && current.terminalAtMs === null) return { status: 'active_run_conflict' as const };
        const event: HandoffSucceededEvent = {
          eventId: input.eventId, source: 'app_handoff', baseRevision: current?.revision ?? 0, occurredAtMs: input.occurredAtMs,
          courseRunId: input.plan.courseRunId, type: 'handoff_succeeded', targetKind: route.targetKind, targetStopId: route.targetStopId,
          targetTitle: route.targetTitle, moveMin: route.moveMin,
          departingStopId: current?.phase === 'dwelling' || current?.phase === 'departure_due' ? current.activeStopId : null,
          nextBoundaryAtMs: route.nextBoundaryAtMs, departureReminderAtMs: route.departureReminderAtMs,
        };
        if (!current) {
          try {
            const state = buildLocalProgressState(input.plan.snapshot, event);
            const activityOk = await persistUpdate(state, true);
            return { status: activityOk ? 'started' as const : 'started_without_activity' as const, state };
          } catch { return { status: 'invalid_snapshot' as const }; }
        }
        return apply(current, event);
      });
    },
    confirmArrival(input: Readonly<{ courseRunId: string; stopId: string; occurredAtMs: number; eventId: string; source: 'app_action' | 'notification_action' }>) {
      // Synchronous action-time snapshot, before any async read/recovery.
      let evidence: unknown;
      try { if (input.source === 'app_action') evidence = dependencies.learning?.capture(input.courseRunId); } catch { /* progress stays available */ }
      return serial(async () => {
        let current: LocalProgressState | null;
        try { current = await read(); } catch { return { status: 'storage_unreadable' as const }; }
        if (!current || current.courseRunId !== input.courseRunId) return { status: 'not_found' as const };
        return apply(current, { ...input, evidence, baseRevision: current.revision, type: 'arrival_confirmed' });
      });
    },
    applyEvent(event: LocalProgressEvent) {
      return serial(async () => {
        let current: LocalProgressState | null;
        try { current = await read(); } catch { return { status: 'storage_unreadable' as const }; }
        if (!current || current.courseRunId !== event.courseRunId) return { status: 'not_found' as const };
        return apply(current, event);
      });
    },
    reconcile(courseRunId: string) {
      return serial(async () => {
        const diagnosticAttemptId = `reconcile-${Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(36)}-${Date.now().toString(36)}`;
        dependencies.diagnostic?.({ action: 'receipt', attemptId: diagnosticAttemptId, stage: 'receipt_read_before', result: 'started' });
        let current: LocalProgressState | null;
        try { current = await read(); } catch {
          dependencies.diagnostic?.({ action: 'receipt', attemptId: diagnosticAttemptId, stage: 'receipt_read_after', result: 'failed', error: 'storage_unreadable' });
          return { status: 'storage_unreadable' as const, diagnosticAttemptId };
        }
        if (!current || current.courseRunId !== courseRunId) {
          dependencies.diagnostic?.({ action: 'receipt', attemptId: diagnosticAttemptId, stage: 'receipt_read_after', result: 'absent' });
          return { status: 'not_found' as const, diagnosticAttemptId };
        }
        if (current.terminalAtMs !== null) {
          if (await cleanupTerminal(current)) { await dependencies.storage.clear(); return { status: 'terminal_cleaned' as const, diagnosticAttemptId }; }
          return { status: 'terminal_cleanup_pending' as const, state: current, diagnosticAttemptId };
        }
        let received: readonly Readonly<{ receiptId: string; raw: string }>[];
        try { received = await dependencies.storage.listReceipts(); }
        catch {
          dependencies.diagnostic?.({ action: 'receipt', attemptId: diagnosticAttemptId, stage: 'receipt_read_after', result: 'failed', error: 'storage_unreadable', phase: current.phase, revision: current.revision });
          return { status: 'storage_unreadable' as const, diagnosticAttemptId };
        }
        const receipts = [...received].map(item => ({ ...item, event: parseReceipt(item.raw) }))
          .filter((item): item is typeof item & { event: LocalProgressEvent } => Boolean(item.event && item.event.courseRunId === courseRunId))
          .sort((left, right) => left.event.baseRevision - right.event.baseRevision || left.event.occurredAtMs - right.event.occurredAtMs);
        let changed = false;
        for (const item of receipts) {
          const reduced = reduceLocalProgressEvent(current, item.event);
          if (reduced.applied) {
            current = reduced.state; await dependencies.storage.write(JSON.stringify(current)); changed = true;
            dependencies.diagnostic?.({ action: 'receipt', attemptId: diagnosticAttemptId, stage: 'receipt_accepted', result: 'succeeded', phase: current.phase, revision: current.revision });
          } else dependencies.diagnostic?.({ action: 'receipt', attemptId: diagnosticAttemptId, stage: 'receipt_rejected', result: 'rejected', error: 'receipt_rejected', phase: current.phase, revision: current.revision });
          if (reduced.applied || item.event.baseRevision <= current.revision || current.processedEventIds.includes(item.event.eventId)) {
            consume(current, item.event, reduced.applied, item.receiptId);
          }
        }
        if (changed) {
          try { await dependencies.activity.update(current); } catch { /* 앱 진행 복구는 유지한다. */ }
          try { await dependencies.notification.sync(current); } catch { /* 권한과 무관하게 복구한다. */ }
        }
        replayFirst(current);
        dependencies.diagnostic?.({ action: 'receipt', attemptId: diagnosticAttemptId, stage: 'receipt_read_after', result: receipts.length ? 'observed' : 'absent', phase: current.phase, revision: current.revision });
        return { status: 'ready' as const, state: current, diagnosticAttemptId };
      });
    },
    finish(input: Readonly<{ courseRunId: string; terminal: 'completed' | 'cancelled' | 'expired' | 'incomplete'; occurredAtMs: number; eventId: string }>) {
      void dependencies.learning?.close?.(input.courseRunId, input.terminal === 'incomplete' ? 'expired' : input.terminal).catch(() => undefined);
      return serial(async () => {
        let current: LocalProgressState | null;
        try { current = await read(); } catch { return { status: 'storage_unreadable' as const, actualDwellByPlaceId: {} }; }
        if (!current || current.courseRunId !== input.courseRunId) {
          if (!dependencies.cleanup) return { status: 'already_ended' as const, actualDwellByPlaceId: {} };
          const prepared = await dependencies.cleanup.prepare(input.courseRunId);
          if (prepared.status === 'storage_unreadable') return { status: 'cleanup_pending' as const, actualDwellByPlaceId: {} };
          const cleaned = (await dependencies.cleanup.retry(input.courseRunId)).status === 'clean';
          return { status: cleaned ? 'already_ended' as const : 'cleanup_pending' as const, actualDwellByPlaceId: {} };
        }
        const dwell = actualDwell(current);
        const reduced = reduceLocalProgressEvent(current, { ...input, source: 'app_action', baseRevision: current.revision, type: 'terminal' });
        const terminal = reduced.applied ? reduced.state : current;
        if (dependencies.cleanup) {
          const prepared = await dependencies.cleanup.prepare(input.courseRunId);
          if (prepared.status === 'storage_unreadable') return { status: 'cleanup_pending' as const, actualDwellByPlaceId: dwell };
        }
        if (reduced.applied) {
          try { await dependencies.storage.write(JSON.stringify(terminal)); }
          catch { return { status: 'cleanup_pending' as const, actualDwellByPlaceId: dwell }; }
        }
        const cleaned = dependencies.cleanup
          ? (await dependencies.cleanup.retry(input.courseRunId)).status === 'clean'
          : await cleanupTerminal(terminal);
        if (cleaned) await dependencies.storage.clear();
        return { status: cleaned ? 'ended' as const : 'cleanup_pending' as const, actualDwellByPlaceId: dwell };
      });
    },
    readState: () => serial(read),
    readActualDwell(courseRunId: string) {
      return serial(async () => {
        let state: LocalProgressState | null;
        try { state = await read(); } catch { return {}; }
        return state?.courseRunId === courseRunId ? actualDwell(state) : {};
      });
    },
  };
}
