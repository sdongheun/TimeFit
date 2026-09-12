import assert from 'node:assert/strict';
import test from 'node:test';
import { createPendingCompletionController, canFinishFromPending } from '../../src/ui/liveActivity/pendingCompletionModel';
import { authorizePendingCompletion } from '../../src/ui/liveActivity/completionAuthorization';
import { personalizationSession } from '../../src/ui/personalizationComposition';
const action: any = { schemaVersion: 1, purpose: 'course_progress_completion', actionId: 'finish-1', courseRunId: 'run', stopId: 'final-destination', baseRevision: 8, state: 'pending' };
const active: any = { courseRunId: 'run', progress: { stepIndex: 2, finished: false, routeOpened: true }, course: { placeIds: ['a'] } };
const local: any = { courseRunId: 'run', phase: 'traveling', revision: 8, terminalAtMs: null, route: { targetKind: 'final_destination' }, stops: [{ placeId: 'a', departedAtMs: 10 }], activeStopId: null };
const steps: any = [{ kind: 'travel', isFinal: false }, { kind: 'stay' }, { kind: 'travel', isFinal: true }];
test('LAFINAL readonly ownership: account mismatch, missing proof, consent/account changes are not repaired', async () => {
  const found: any = { status: 'found', courseRunId: 'run', ownerKind: 'account', ownerMatch: true, cleanupProof: null };
  personalizationSession.setAccount('fixture-A');
  assert.equal(await authorizePendingCompletion('run', async input => { assert.deepEqual(input.viewer, { kind: 'account', subject: 'fixture-A' }); return found; }), true);
  assert.equal(await authorizePendingCompletion('run', async () => ({ ...found, ownerMatch: false })), false);
  assert.equal(await authorizePendingCompletion('run', async () => ({ status: 'not_found' })), false);
  assert.equal(await authorizePendingCompletion('run', async () => { personalizationSession.setAccount('fixture-B'); personalizationSession.setAccount('fixture-A'); return found; }), false);
  assert.equal(await authorizePendingCompletion('run', async () => { personalizationSession.invalidate(); return found; }), false);
  personalizationSession.setAccount(null);
  assert.equal(await authorizePendingCompletion('run', async () => ({ ...found, ownerKind: 'guest' })), true);
  assert.equal(await authorizePendingCompletion('run', async () => ({ ...found, ownerKind: 'account', ownerMatch: false })), false);
});
test('LAFINAL valid final only; stale/terminal/intermediate/preparing/departure reject', () => {
  assert.equal(canFinishFromPending(action, active, local, steps), true);
  assert.equal(canFinishFromPending(action, active, { ...local, stops: [{ placeId: 'a', departedAtMs: null }] } as any, steps), true, 'missing dwell evidence excludes learning, not explicit course completion');
  for (const other of [{ ...local, revision: 9 }, { ...local, terminalAtMs: 1 }, { ...local, courseRunId: 'other' }, { ...local, handoffPreparation: { status: 'pending' } }, { ...local, route: { targetKind: 'visit_stop' } }]) assert.equal(canFinishFromPending(action, active, other, steps), false);
  assert.equal(canFinishFromPending({ ...action, purpose: 'course_progress_navigation' }, active, local, steps), false);
  assert.equal(canFinishFromPending(action, { ...active, progress: { stepIndex: 1 } }, local, steps), false);
});
test('LAFINAL duplicate, cold executing, failure and context switch never fake completion', async () => {
  let writes = 0, clears = 0, current = true, finishResult = false;
  const controller = createPendingCompletionController({ transition: async () => true, clear: async () => { clears++; } });
  const input = { action, active, local, steps, isCurrent: () => current, authorize: async () => true, finish: async () => { writes++; return finishResult; } };
  assert.equal(await controller.consume(input), 'failed'); assert.equal(clears, 0);
  current = false; assert.equal(await controller.consume(input), 'invalid'); assert.equal(writes, 1);
  current = true; finishResult = true;
  const cold = { ...input, action: { ...action, state: 'executing' as const } };
  assert.equal(await controller.consume(cold), 'finished'); assert.equal(clears, 1);
  assert.equal(await controller.consume(cold), 'ignored'); assert.equal(writes, 2);
});

test('LAFINAL two-stop final, simultaneous callbacks and account change during claim', async () => {
  const two: any = { ...active, course: { placeIds: ['a', 'b'] }, progress: { stepIndex: 4, routeOpened: true, finished: false } };
  const twoLocal: any = { ...local, stops: [{ placeId: 'a', departedAtMs: 1 }, { placeId: 'b', departedAtMs: 2 }] };
  const twoSteps: any = [...steps.slice(0, 2), { kind: 'travel', isFinal: false }, { kind: 'stay' }, { kind: 'travel', isFinal: true }];
  assert.equal(canFinishFromPending(action, two, twoLocal, twoSteps), true);
  let resolve: (v: boolean) => void = () => {}, writes = 0, current = true;
  const controller = createPendingCompletionController({ transition: async () => new Promise<boolean>(r => { resolve = r; }), clear: async () => {} });
  const input = { action, active: two, local: twoLocal, steps: twoSteps, isCurrent: () => current, authorize: async () => true, finish: async () => { writes++; return true; } };
  const running = controller.consume(input); await Promise.resolve();
  assert.equal(await controller.consume(input), 'busy');
  current = false; resolve(true);
  assert.equal(await running, 'invalid'); assert.equal(writes, 0);
});
