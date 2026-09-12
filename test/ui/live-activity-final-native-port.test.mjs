import assert from 'node:assert/strict';
import test from 'node:test';
import 'tsx/cjs';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
test('LAFINAL native port keeps completion distinct, exact clears and auth revocation observable', async () => {
  let revoked = 0, cleared;
  const pending = { schemaVersion: 1, purpose: 'course_progress_completion', actionId: 'fixture', courseRunId: 'run', stopId: 'final-destination', baseRevision: 3, state: 'pending' };
  const native = { Platform: { OS: 'ios' }, NativeModules: { TimeFitLiveActivityModule: {
    readPendingNavigationAction: async () => pending,
    revokeCompletionActions: async () => { revoked++; },
    clearPendingNavigationAction: async value => { cleared = value; },
  } } };
  const file = new URL('../../src/ui/liveActivity/nativeLiveActivityPort.ts', import.meta.url);
  const require = createRequire(file), exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'exports', code)(id => id === 'react-native' ? native : require(id), exports);
  const { nativePendingNavigationPort: port } = exports;
  assert.deepEqual(await port.read(), pending);
  await port.revokeCompletion(); assert.equal(revoked, 1);
  await port.clear(pending); assert.deepEqual(cleared, { actionId: 'fixture', courseRunId: 'run' });
});
