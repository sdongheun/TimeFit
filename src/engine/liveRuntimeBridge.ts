import {
  COURSE_V1_ADAPTER_CALL_LIMIT, COURSE_V1_INITIAL_PROVIDER_ATTEMPT_LIMIT,
  normalizeCourseV1ReceiptInternal,
  type CourseV1Candidate, type CourseV1Input, type CourseV1LimitedInput,
  type CourseV1Point, type CourseV1ReleaseOneStopResult, type CourseV1RouteReceipt, type CourseV1RouteReceiptAdapter,
} from './courseV1';
import {
  RELEASE_TWO_STOP_AUTOMATIC_ATTEMPT_LIMIT, RELEASE_TWO_STOP_SHARED_ATTEMPT_LIMIT,
  RELEASE_TWO_STOP_SESSION_ATTEMPT_LIMIT, type ReleaseTwoStopAttemptLedger,
} from './twoStopSelectionV1';

export type LiveRuntimePhase = 'automatic' | 'shared';
export type LiveRuntimeBridge = Readonly<{
  input: CourseV1LimitedInput;
  result: CourseV1ReleaseOneStopResult;
  /** Immutable initial ledger, not the latest UI ledger. */
  ledger: ReleaseTwoStopAttemptLedger;
  ledgerStore: Readonly<{ read(): ReleaseTwoStopAttemptLedger; commit(next: ReleaseTwoStopAttemptLedger): void }>;
  /** Safe counters only. UI must commit its independently observed ledger, not copy this to hide a discrepancy. */
  actualLedger(): ReleaseTwoStopAttemptLedger;
  run<T>(phase: LiveRuntimePhase, uiLedger: ReleaseTwoStopAttemptLedger, operation: () => Promise<T>): Promise<T>;
}>;

export function frozenLiveCopy<T>(value: T): T {
  const copy = structuredClone(value);
  const freeze = (v: unknown): void => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } };
  freeze(copy);
  return copy;
}
const sameLedger = (a: ReleaseTwoStopAttemptLedger, b: ReleaseTwoStopAttemptLedger) => a?.version === 1 && b.version === 1
  && a.initialOneStopAttempts === b.initialOneStopAttempts && a.automaticTwoStopAttempts === b.automaticTwoStopAttempts
  && a.sharedExpansionAttempts === b.sharedExpansionAttempts && a.totalNewProviderAttempts === b.totalNewProviderAttempts;
const pointKey = (p: CourseV1Point) => JSON.stringify([p.id, p.lat, p.lon]);
const unavailable = (reason: 'limited' | 'rejected' | 'transport' | 'invalid_response', count: 0 | 1 | 2 = 0): CourseV1RouteReceipt => ({ result: 'unavailable', reason, newProviderAttemptCount: count, reused: false });

/** One owner across progressive initial evaluation and sealed runtime operations. No external I/O implementation. */
export function createLiveRouteBudgetOwner(port: CourseV1RouteReceiptAdapter) {
  const counts = { initial: 0, automatic: 0, shared: 0 };
  const cache = new Map<string, CourseV1RouteReceipt>();
  let initialCalls = 0;
  let initialUnavailable = false;
  let sealed = false;
  let phase: LiveRuntimePhase | null = null;
  let operationCalls = 0;
  let inFlight = false;
  let broken = false;
  let allowedPoints = new Set<string>();
  let committed: ReleaseTwoStopAttemptLedger | null = null;
  const ledger = (): ReleaseTwoStopAttemptLedger => frozenLiveCopy({ version: 1,
    initialOneStopAttempts: counts.initial, automaticTwoStopAttempts: counts.automatic, sharedExpansionAttempts: counts.shared,
    totalNewProviderAttempts: counts.initial + counts.automatic + counts.shared });
  async function getReceipt(stage: 'initial' | LiveRuntimePhase, from: CourseV1Point, to: CourseV1Point, max: 0 | 1 | 2): Promise<CourseV1RouteReceipt> {
    if (broken || inFlight || (stage === 'initial' ? sealed || initialUnavailable : !sealed || phase !== stage)) return unavailable('rejected');
    if (stage !== 'initial' && (!allowedPoints.has(pointKey(from)) || !allowedPoints.has(pointKey(to)))) return unavailable('rejected');
    if (!Number.isInteger(max) || max < 0 || max > 2) return unavailable('invalid_response');
    const key = `${pointKey(from)}>${pointKey(to)}`;
    const saved = cache.get(key);
    if (saved) return { ...structuredClone(saved), newProviderAttemptCount: 0, reused: true };
    const cap = stage === 'initial' ? COURSE_V1_INITIAL_PROVIDER_ATTEMPT_LIMIT : stage === 'automatic' ? RELEASE_TWO_STOP_AUTOMATIC_ATTEMPT_LIMIT : RELEASE_TWO_STOP_SHARED_ATTEMPT_LIMIT;
    const allowance = Math.min(max, cap - counts[stage], RELEASE_TWO_STOP_SESSION_ATTEMPT_LIMIT - ledger().totalNewProviderAttempts) as 0 | 1 | 2;
    if (!allowance || (stage === 'initial' ? initialCalls : operationCalls) >= COURSE_V1_ADAPTER_CALL_LIMIT) return unavailable('limited');
    inFlight = true;
    counts[stage] += allowance; // Reserve before dispatch; an unobserved failure keeps its reservation.
    if (stage === 'initial') initialCalls++; else operationCalls++;
    let receipt: CourseV1RouteReceipt;
    try {
      const value = await port.getRouteReceipt(structuredClone(from), structuredClone(to), { maxNewProviderAttemptCount: allowance });
      if (!value || !Number.isInteger(value.newProviderAttemptCount) || value.newProviderAttemptCount < 0 || value.newProviderAttemptCount > allowance || typeof value.reused !== 'boolean') receipt = unavailable('invalid_response', allowance);
      else {
        const clean = normalizeCourseV1ReceiptInternal(value, allowance);
        const counters = { newProviderAttemptCount: clean.newProviderAttemptCount, reused: clean.reused };
        receipt = clean.result === 'exact' ? { result: 'exact', route: clean.route, ...counters }
          : clean.result === 'no_route' ? { result: 'no_route', ...counters }
          : { result: 'unavailable', reason: clean.reason, ...counters };
      }
    } catch { receipt = unavailable('transport', allowance); }
    counts[stage] -= allowance - receipt.newProviderAttemptCount;
    inFlight = false;
    if (receipt.result !== 'unavailable') cache.set(key, frozenLiveCopy(receipt));
    else if (stage === 'initial') initialUnavailable = true;
    return structuredClone(receipt);
  }
  const initialReceiptRoutes: CourseV1RouteReceiptAdapter = Object.freeze({ getRouteReceipt: (from, to, budget) => getReceipt('initial', from, to, budget.maxNewProviderAttemptCount) });
  function seal(context: Omit<CourseV1Input, 'candidates' | 'routes'>, candidates: readonly CourseV1Candidate[], result: CourseV1ReleaseOneStopResult): LiveRuntimeBridge {
    if (sealed || inFlight) throw new Error('session_sealed');
    sealed = true;
    const fixed = frozenLiveCopy(context);
    const pool = frozenLiveCopy(candidates);
    allowedPoints = new Set([fixed.origin, fixed.destination ?? fixed.origin, ...pool].map(pointKey));
    const initialLedger = ledger();
    committed = initialLedger;
    const commit = (next: ReleaseTwoStopAttemptLedger) => {
      if (broken || !phase || inFlight || !sameLedger(next, ledger())) { broken = true; throw new Error('ledger_mismatch'); }
      committed = frozenLiveCopy(next);
    };
    const receiptRoutes: CourseV1RouteReceiptAdapter = Object.freeze({ getRouteReceipt: (from, to, budget) => phase ? getReceipt(phase, from, to, budget.maxNewProviderAttemptCount) : Promise.resolve(unavailable('rejected')) });
    const runtimeInput: CourseV1LimitedInput = Object.freeze({
      ...fixed,
      get now() { return new Date(fixed.now.getTime()); },
      provider: Object.freeze({ listRepresentativeCandidates: () => frozenLiveCopy(pool) }),
      receiptRoutes,
      routes: Object.freeze({ getRoute: async () => null }),
    });
    const run = async <T>(nextPhase: LiveRuntimePhase, uiLedger: ReleaseTwoStopAttemptLedger, operation: () => Promise<T>): Promise<T> => {
      if (phase || inFlight) throw new Error('runtime_operation_in_progress');
      if (nextPhase !== 'automatic' && nextPhase !== 'shared') throw new Error('invalid_runtime_phase');
      if (broken || !sameLedger(uiLedger, ledger()) || !sameLedger(committed!, ledger())) { broken = true; throw new Error('ledger_mismatch'); }
      phase = nextPhase;
      operationCalls = 0;
      try {
        const value = await operation();
        if (broken || inFlight || !sameLedger(committed!, ledger())) { broken = true; throw new Error('ledger_mismatch'); }
        return value;
      } catch {
        if (inFlight || !sameLedger(committed!, ledger())) broken = true;
        throw new Error(broken ? 'ledger_mismatch' : 'runtime_operation_failed');
      } finally { phase = null; }
    };
    return Object.freeze({ input: runtimeInput, result: frozenLiveCopy(result), ledger: initialLedger,
      ledgerStore: Object.freeze({ read: () => frozenLiveCopy(committed!), commit }), actualLedger: ledger, run });
  }
  return Object.freeze({ initialReceiptRoutes, seal, ledger,
    stats: () => ({ initialCalls, initialUnavailable, cacheEntries: cache.size }) });
}
